---
title: Ray and the inference worker
category: admin
slug: admin-ray-inference
nav_order: 2
---

# Ray and the inference worker

The inference worker runs a Ray HEAD node that manages all vLLM deployments via Ray Serve. You do not need to know Ray internals to operate it, but understanding the dashboard and log output will save time when diagnosing issues.

---

## The Ray dashboard

The dashboard is available at `http://localhost:8265` when the inference worker is running.

The most useful views for day-to-day operation are:

**Serve** — shows all active Ray Serve deployments, their replica count, and health status. Each deployment corresponds to one active vLLM instance. A deployment named `vllm_dep_cDBDmVAvwc9fjaZF0FIgfx` maps directly to an `InferenceDeployment` record in the database with that ID suffix.

**Actors** — shows the live Ray actors. Each `VLLMDeployment` replica appears here. If a deployment is stuck scheduling, its actor will show as `PENDING` rather than `ALIVE`.

**Logs** — per-actor log streaming. Useful for reading vLLM output directly without shelling into the container.

**Cluster** — shows available resources. The key value to watch is `GPU: 1.0` in the available column. If it reads `GPU: 0.0`, the GPU is fully claimed by a running deployment.

---

## HEAD node vs inference worker

The inference worker container is the Ray HEAD node. It owns the GPU and runs Ray Serve. There is no separate Ray cluster to connect to — the HEAD is the cluster for single-node deployments.

The training worker joins this cluster as a Ray client via `ray://inference_worker:10001`, but it does not run inference workloads. GPU contention between training and inference is a scheduling concern on single-GPU machines and is covered below.

---

## What healthy startup looks like

When the inference worker boots, you should see this sequence in the logs:

```
Ray HEAD started — dashboard: http://localhost:8265
Ray client server started on port 10001
Ray resources: {'GPU': 1.0, 'CPU': 8.0, ...}
Ray Serve started on port 8000
InferenceReconciler active — polling every 20s
```

When the reconciler picks up a pending deployment:

```
Deploying via Ray Serve: vllm_dep_... model=unsloth/... tp=1 gpu_mem_util=0.50
```

vLLM then initialises. This takes time. The sequence is normal and expected:

```
Starting to load model unsloth/...
Loading weights with BitsAndBytes quantization. May take a while ...
Loading safetensors checkpoint shards: 100%
Model loading took 1.49 GiB and 22.7 seconds
Memory profiling takes 3.67 seconds
the current vLLM instance can use total_gpu_memory (8.00GiB) x gpu_memory_utilization (0.50) = 4.00GiB
model weights take 1.49GiB; PyTorch activation peak memory takes 1.39GiB; KV Cache is 1.09GiB
cuda blocks: 2542, CPU blocks: 9362
Capturing cudagraphs for decoding.
Capturing CUDA graph shapes: 100%|██████████| 35/35
Graph capturing finished in 21 secs
```

The deployment is ready when you see:

```
Application 'vllm_dep_...' is ready at http://0.0.0.0:8000/vllm_dep_...
Ray Serve deployment active: vllm_dep_... (gpu_mem_util=0.50)
```

Total cold start time for a 1.5B 4-bit quantized model on an 8 GB GPU is typically 60 to 90 seconds from the point the reconciler triggers the deploy.

---

## Common warnings and what they mean

### "Deployment has 1 replica that has taken more than 30s to initialize"

```
WARNING controller -- Deployment 'vllm_dep_...' has 1 replicas that have taken
more than 30s to initialize. This may be caused by a slow __init__ or reconfigure method.
```

This is normal. vLLM loading weights and capturing CUDA graphs takes 60 to 90 seconds. Ray Serve starts warning at 30 seconds because it does not know the deployment is deliberately slow. Ignore this warning as long as the CUDA graph capture progress bar is still moving in the logs.

### "Resource request cannot be scheduled right now"

```
Warning: The following resource request cannot be scheduled right now: {'GPU': 1.0, 'CPU': 1.0}.
This is likely due to all cluster resources being claimed by actors.
Total resources available: {"CPU": 7.0}
```

This means the GPU is fully claimed and the new deployment cannot start. On a single-GPU machine, only one vLLM deployment can hold the GPU at a time.

This happens when a second `activate()` call creates a new `InferenceDeployment` record before the first deployment has been torn down. The reconciler will attempt to deploy both simultaneously, the second one stalls, and Ray Serve logs this warning indefinitely.

The correct resolution is to call `deactivate_all()` first, wait for the reconciler to tear down the existing deployment, then call `activate()` again. The `activate()` endpoint does attempt to clean up existing deployments automatically, but there is a window during which both records can coexist.

```python
admin_client.models.deactivate_all()
# wait ~20s for reconciler to process
admin_client.models.activate("ftm_...")
```

### "Using /tmp instead of /dev/shm"

```
WARNING: The object store is using /tmp instead of /dev/shm because /dev/shm
has only 67108864 bytes available.
```

Ray prefers `/dev/shm` for its object store. The default Docker shared memory allocation is 64 MB, which is too small. This does not affect inference correctness but hurts performance for large inter-process data transfers. Add `--shm-size=2g` to the inference worker container or set it in the compose file:

```yaml
inference-worker:
  shm_size: '2gb'
```

---

## Notes

- The `/dev/shm` warning appears on every startup until the shared memory size is increased. It is safe to ignore on development machines.
- The Ray dashboard is exposed on port `8265`. It should not be publicly accessible in production.
- On single-GPU machines, do not run a training job while a vLLM deployment is active. The training worker will attempt to claim the GPU and both processes will starve. Call `deactivate_all()` before submitting a training job.