---
title: Sovereign Cluster
category: admin
slug: admin-sovereign-cluster
nav_order: 5
---

# Sovereign Cluster

A Sovereign Cluster is a distributed GPU inference mesh built on Ray, where one or more machines contribute their GPUs to a shared pool managed by a single deployment manager. From the platform's perspective the cluster is one resource. It schedules model deployments across any node with sufficient capacity, load balances replicas, and recovers from node failures without operator intervention.

The cluster is built around two roles. The HEAD node is your primary machine. It runs the full Project David stack, owns the Ray cluster, hosts the InferenceReconciler, and is the only node that needs to be publicly accessible. Worker nodes are any additional GPU machines that join the HEAD and contribute their VRAM to the inference mesh. Workers have no public-facing requirements — they reach the HEAD, not the other way around.

A single-node deployment is a cluster of one. Everything here applies to it. The difference when you add workers is that the same deployment commands, the same activation scripts, and the same `pdavid ray` tooling continue to work without modification. Ray handles the distribution transparently.

---

## Single Node

The single-node deployment is the starting point for every Sovereign Cluster. You do not need additional hardware, special configuration, or any cluster-specific setup. Running the full stack with the training profile is sufficient.

```bash
pdavid --mode up --training
```

This starts the inference worker as the Ray HEAD node. Ray initialises, claims the local GPU, starts Ray Serve on port 8000, and launches the InferenceReconciler. From this point Ray is actively managing compute — it tracks available resources, monitors deployment health, and will automatically redeploy any application that becomes unhealthy.

The stack is running but idle. No model is loaded and no GPU memory is allocated until you activate a deployment through the registry. Ray simply sits ready, watching for work.

```
Ray HEAD started — dashboard: http://localhost:80/ray/
Ray Serve started on port 8000
InferenceReconciler active — polling every 20s
```

You can inspect the cluster at any time:

```bash
pdavid ray --status      # resource totals and availability
pdavid ray --dashboard   # print the dashboard URL
```

The Ray dashboard at `http://localhost:80/ray/` gives a live view of node health, GPU utilisation, and active Serve deployments. On a single node you will see one node listed, one GPU, and no active deployments until a model is activated.

This is a fully functional cluster. The only thing that changes when you add worker nodes is the resource pool Ray has to schedule against. The deployment manager, the activation workflow, and the operator experience are identical whether the cluster has one node or ten.

---

## Tailscale Networking

Tailscale is the recommended networking layer for any Sovereign Cluster that spans more than one physical location. If you are adding a cloud VM, a remote bare-metal machine, or any node that is not on the same local network as your HEAD, use Tailscale. It creates a private mesh network between your machines using WireGuard, assigning each node a stable `100.x.x.x` IP that persists across reboots, container recreates, and IP changes on the underlying network.

For a Sovereign Cluster this matters because Ray requires stable, bidirectional connectivity between the HEAD and every worker node. Without a private overlay, off-premises worker nodes require port forwarding, firewall rules, or SSH tunnels to establish that connectivity. Tailscale eliminates all of that. Nodes authenticate once and reach each other directly regardless of NAT, firewalls, or physical location.

### When to use it

Use Tailscale any time your cluster spans more than one network:

- HEAD on your local machine, worker on a remote GPU machine
- HEAD at home or in an office, worker on a cloud instance
- Any configuration where nodes cannot reach each other by private LAN IP

For clusters where all nodes share the same local network, Tailscale is optional. You can point `RAY_ADDRESS` directly at the HEAD's LAN IP and skip Tailscale entirely.

### Setting up Tailscale

You will need a Tailscale account. Sign up at [tailscale.com](https://tailscale.com) if you do not have one. The free plan supports up to 100 devices, which is sufficient for any Sovereign Cluster deployment.

**1. Generate an auth key**

Go to [login.tailscale.com/admin/settings/keys](https://login.tailscale.com/admin/settings/keys) and generate a reusable auth key. A reusable key allows the inference worker container to authenticate automatically on every start without manual approval.

**2. Set the auth key and node IP in `.env`**

```bash
pdavid configure --set TAILSCALE_AUTH_KEY=tskey-auth-your-key-here
pdavid configure --set NODE_IP=100.x.x.x
```

`NODE_IP` should be this machine's Tailscale IP. Find it by running `tailscale ip` on the host after Tailscale is installed.

**3. Restart the inference worker**

```bash
pdavid --mode up --training --force-recreate
```

The inference worker container will authenticate with Tailscale on startup and advertise itself at the `NODE_IP` you configured. The Tailscale state is persisted in a Docker volume so the container gets the same `100.x.x.x` IP on every restart — no re-authentication required after the first run.

### Verifying Tailscale connectivity

Check that the node is visible in your Tailscale admin panel at [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines). You should see the inference worker listed as a connected device.

From the HEAD node, confirm the worker is reachable:

```bash
ping 100.x.x.x
```

Once Tailscale is confirmed working, worker nodes join the cluster using the HEAD's Tailscale IP:

```bash
pdavid worker --join 100.x.x.x
```

---

## RunPod

RunPod is an on-demand GPU cloud marketplace. You rent a GPU machine by the hour, pay only for what you use, and terminate it when you are done. There is no commitment, no minimum spend, and no infrastructure to manage. For a Sovereign Cluster it is the fastest way to add GPU capacity when your local hardware is not enough — spin up a worker node in under a minute, run an inference job, tear it down.

Project David ships a pre-configured RunPod template that handles everything. The correct inference worker image is already set, the environment variables are pre-wired, and the container is configured to join your cluster automatically once Tailscale and the database connection are in place. You do not need to configure Docker, install dependencies, or write any deployment scripts.

### Deploying the template

**[Deploy Sovereign Forge Worker on RunPod →](https://console.runpod.io/deploy?template=4lvbs00lnn&ref=utp431s6)**

You will need a RunPod account. Sign up at [runpod.io](https://www.runpod.io) if you do not have one.

Click the link above to open the template directly. Before deploying, click **Customize Deployment** and fill in the following environment variables:

| Variable | Value | Where to get it |
|---|---|---|
| `DATABASE_URL` | `mysql+pymysql://api_user:<password>@<tailscale-ip>:3307/entities_db` | Copy `MYSQL_PASSWORD` from your local `.env`, substitute your HEAD node's Tailscale IP |
| `REDIS_URL` | `redis://<tailscale-ip>:6379/0` | Your HEAD node's Tailscale IP |
| `RAY_ADDRESS` | `ray://<tailscale-ip>:10001` | Your HEAD node's Tailscale IP |
| `TAILSCALE_AUTH_KEY` | `tskey-auth-...` | Generate at [login.tailscale.com/admin/settings/keys](https://login.tailscale.com/admin/settings/keys) |
| `HF_TOKEN` | `hf_...` | Your HuggingFace access token |
| `NODE_ID` | `runpod-worker` | Leave as-is or set a descriptive name |

Set the container disk to at least **40 GB** to accommodate the inference worker image and model weights.

### Choosing a GPU

Select a GPU that matches the models you intend to serve. Use the VRAM table in the [vLLM](/docs/admin-vllm) guide as a reference. For quantised 7B models, an RTX 4090 (24 GB) is a strong choice. For larger models, A100 and H100 pods are available on Secure Cloud.

### Joining the cluster

Once the pod is running, the inference worker starts automatically and connects to your HEAD node via Tailscale. No SSH tunnel required. Within 60 seconds the worker's GPU will appear in your cluster:

```bash
pdavid ray --status
```

Under resource totals you will see the combined GPU count from both your local machine and the RunPod worker. The cluster is ready to receive deployments.

### Stopping the pod

Terminate the pod from the RunPod console when you are finished. Stopped pods retain their disk but do not incur compute charges. Terminated pods are destroyed completely. If you stop and restart a pod, the Tailscale IP on the worker side may change — update `RAY_ADDRESS` in the pod's environment variables with the new Tailscale IP before restarting.

---

## Airgapped Clusters
 
An airgapped cluster operates with no outbound internet access on any node. All model weights must be pre-staged before the stack starts, and all inter-node communication must occur over private infrastructure. This is the deployment model for sovereign operators who cannot or will not allow outbound connections from their inference infrastructure.
 
### Weight pre-staging
 
The deployment manager does not download weights at activation time on airgapped nodes — it expects them to already be present in the HuggingFace cache. If the weights are missing, activation will fail immediately rather than hanging on a network timeout.
 
Pre-stage weights on every node that will serve a model before starting the cluster. The `pdavid cache` command handles this from the CLI:
 
```bash
# Download weights into the inference worker cache
pdavid cache --download unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit
 
# Verify they are present
pdavid cache --list
```
 
For fully airgapped environments where the inference worker itself has no internet access, download the weights on a connected machine first and transfer the cache directory to each node:
 
```bash
rsync -avz ~/.cache/huggingface/hub/models--unsloth--qwen2.5-1.5b-instruct-unsloth-bnb-4bit \
    user@airgapped-node:/root/.cache/huggingface/hub/
```
 
In a multi-node cluster, every node that could receive a Ray Serve deployment must have the weights. The scheduler does not check cache state before placing a deployment — if the weights are missing on the node Ray selects, the activation will fail on that node.
 
### Preventing outbound requests
 
Once weights are staged, set `HF_HUB_OFFLINE=1` to prevent the inference worker from attempting any outbound HuggingFace requests. With this set, vLLM will fail immediately on a cache miss rather than hanging:
 
```bash
pdavid configure --set HF_HUB_OFFLINE=1
```
 
Restart the inference worker to apply:
 
```bash
pdavid --mode up --training --force-recreate
```
 
### Private networking
 
For airgapped multi-node clusters, Tailscale is still the recommended connectivity layer — it requires only outbound HTTPS to the Tailscale coordination server during initial setup, then operates peer-to-peer with no further external dependencies. For environments where even that initial outbound connection is not permitted, any private network where nodes can reach each other on the required ports is sufficient.
 
The ports that must be open between HEAD and worker nodes:
 
| Port | Purpose |
|---|---|
| 10001 | Ray client server — worker joins cluster |
| 6379 | Redis — shared job queue |
| 3307 | MySQL — shared database |
 
No inbound ports need to be open on the HEAD node. Workers initiate all connections to the HEAD.
 
### Node-level access and troubleshooting
 
Each worker node is independent in the ways that matter most operationally. It has its own HuggingFace cache, loads model layers onto its own GPU, and manages its own Ray Serve replicas. When something goes wrong on a specific node — a model fails to load, VRAM is unexpectedly occupied, a cache entry is corrupt, or a Ray actor is stuck — you need direct access to that node to diagnose and fix it without touching the rest of the cluster.
 
SSH access on the inference worker container exists for exactly this reason. It gives you a shell inside the container where you can inspect the cache, check GPU state, examine Ray logs, and intervene without restarting the node or affecting running deployments elsewhere.
 
```bash
# Shell into a local inference worker
docker exec -it inference_worker bash
 
# Shell into a remote worker via its Tailscale IP
ssh root@100.x.x.x
```
 
For most day-to-day operations `pdavid cache` and `pdavid ray` cover what you need from the host. SSH is the escape hatch for situations those commands cannot reach — a stuck process, a corrupt weight file, a Ray actor that needs killing, or anything that requires eyes directly inside the container.

---

## Verifying the Cluster

At any point you can inspect the state of the cluster without entering any container. The `pdavid ray` command runs against the inference worker and returns a live view of what Ray sees.

### Cluster status

```bash
pdavid ray --status
```

Prints total cluster resources and what is currently available — GPU count, CPU, memory across all nodes. On a healthy two-node cluster you will see the combined resources of both machines. If a worker node has dropped off the cluster its resources will no longer appear here.

### Active deployments

```bash
pdavid ray --deployments
```

Lists every active Ray Serve application by name and status. Each deployment follows the `vllm_dep_...` naming pattern. Use this to confirm an activation completed, identify a stuck deployment, or find the name of a deployment you need to kill.

### GPU memory

```bash
pdavid ray --gpu
```

Runs `nvidia-smi` inside the inference worker and returns a per-GPU summary of name, used memory, free memory, total memory, and utilisation percentage. Useful for confirming VRAM was released after deactivation, or checking headroom before activating another model.

### Dashboard

```bash
pdavid ray --dashboard
```

Prints the dashboard URL. The dashboard at `http://localhost:80/ray/` provides a full graphical view of cluster nodes, resource utilisation, active Serve deployments, and replica health. Under **Node Status** you will see every node currently in the cluster. Under **Resource Status** you will see the combined GPU count across all nodes.

### Targeting a specific node

All `pdavid ray` commands accept `--node` to target a specific inference worker container by name. This is useful in multi-node setups where you need to inspect a particular machine:

```bash
pdavid ray --status --node inference_worker_2
pdavid ray --gpu --node inference_worker_2
```

---

## Scale-out Patterns

The Sovereign Cluster supports two scaling strategies, and they are not mutually exclusive. Vertical scaling adds GPU capacity to existing nodes. Horizontal scaling adds new nodes to the cluster. Both are transparent to the deployment manager — Ray sees a pool of resources and schedules against it regardless of how those resources are distributed across machines.

### Vertical scaling

Vertical scaling means adding more GPUs to a node that is already in the cluster. If your HEAD machine has a second GPU slot, or your RunPod pod has access to multiple GPUs, Ray will detect them automatically and make them available for scheduling. No configuration change is required. Run `pdavid ray --status` after adding hardware to confirm the new GPU appears in the resource totals.

Vertical scaling is the simplest path to more capacity — no networking, no new nodes, no Tailscale setup. The constraint is hardware. Most consumer and prosumer machines max out at one or two GPUs.

### Horizontal scaling

Horizontal scaling means adding a new machine to the cluster as a worker node. Each worker contributes its GPU to the shared resource pool. The deployment manager schedules across all nodes simultaneously — a four-node cluster with one GPU each is equivalent to a single machine with four GPUs from Ray's perspective.

```bash
pdavid worker --join 100.x.x.x
```

There is no upper limit on worker nodes. The practical limit is network stability and the overhead of managing Tailscale keys and cache pre-staging across many machines.

### Weights must be local to each node

When Ray schedules a deployment, it places it on whichever node has a free GPU. It does not transfer model weights between nodes — it assumes the weights are already present on the target node. If a new worker joins the cluster without the weights pre-staged, Ray may schedule a deployment to it and the activation will fail.

Before a worker node is ready to serve a model, pre-stage the weights using `pdavid cache`:

```bash
# Download weights into the worker's cache
pdavid cache --download unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit --node inference_worker_2

# Verify
pdavid cache --list --node inference_worker_2
```

For remote workers joined via `pdavid worker --join`, SSH into the node and run the download directly inside the container:

```bash
ssh root@100.x.x.x
huggingface-cli download unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit
```

Every node that could receive a deployment must have the weights. In a homogeneous cluster where all nodes serve the same models, pre-stage on every node before activating. In a heterogeneous cluster where different nodes serve different models, pre-stage only the relevant weights per node.

### Load balancing

When the same model is activated with multiple replicas, Ray Serve distributes inference requests across all replicas using round-robin scheduling. Each replica runs on a separate GPU. More replicas means more concurrent requests the cluster can service without queuing — throughput scales linearly with replica count.

```python
admin_client.deployments.activate_base(
    base_model_id=registered.id,
    num_replicas=2,
)
```

### Capacity planning

| Cluster | Strategy | Models | Configuration |
|---|---|---|---|
| 1 node, 1 GPU | Single | 1 | 1x 7B 4-bit |
| 1 node, 2 GPU | Vertical | 2 | 1x 7B 4-bit per GPU |
| 1 node, 2 GPU | Vertical | 1 replicated | Load balanced, 2x throughput |
| 2 nodes, 1 GPU each | Horizontal | 2 | 1x 7B 4-bit per node |
| 2 nodes, 1 GPU each | Horizontal | 1 replicated | Load balanced, 2x throughput |
| 4 nodes, 1 GPU each | Horizontal | 4 | Full model diversity, 1 per node |
| 4 nodes, 1 GPU each | Horizontal | 2 replicated | 2 models, 2 replicas each |

The constraint is always VRAM. Each deployment must fit within the VRAM of a single GPU. Plan deployments so that no GPU is asked to host more than it can hold.

### Model sharding across nodes

Sharding a single large model across multiple GPUs on different nodes — tensor parallelism across a cluster — is on the roadmap but not yet implemented. Currently each deployment must fit on a single GPU. For models that exceed single-GPU VRAM, the recommended approach is to use a larger single GPU rather than attempting cross-node distribution.

For activating fine-tuned LoRA adapters alongside base models, see [Model Activation](/docs/admin-model-activation) — multiple adapters share a single base model deployment with no additional VRAM cost.

---

## Stopping and Restarting

### Stopping the stack

```bash
pdavid --mode down_only
```

This brings down the entire stack including the training profile — the inference worker, training worker, and training API all stop cleanly. Ray Serve shuts down, all active deployments are terminated, and GPU memory is released. The base stack services stop too. Your data, volumes, and `.env` are untouched.

To stop only the training cohort and leave the base stack running:

```bash
pdavid --mode down_only --services inference-worker training-worker training-api
```

### Restarting

```bash
pdavid --mode up --training
```

On restart the inference worker comes back up as the Ray HEAD, Ray Serve initialises, and the InferenceReconciler begins polling. Any models that were active before the stop are not automatically reactivated — deployments are not persisted across restarts. Re-activate any models you need through the registry after the stack is back up.

If you want to pull the latest images on restart:

```bash
pdavid --mode up --training --pull
```

### Stopping a RunPod worker

Terminate the pod from the RunPod console when you are finished. The inference worker on the pod will stop, Ray will detect the node has left the cluster, and any deployments scheduled to that node will be marked unhealthy. The InferenceReconciler will attempt to reschedule them to remaining nodes — if no other node has sufficient capacity, the deployment will remain in a degraded state until capacity is restored.

Stopped pods retain their disk and do not incur compute charges. Terminated pods are destroyed completely including the HuggingFace cache — weights will need to be re-downloaded on the next pod.

If you stop and restart a pod, the Tailscale IP on the worker may change. Update `RAY_ADDRESS` in the pod's environment variables with the new Tailscale IP before restarting, then re-join the cluster:

```bash
pdavid worker --join 100.x.x.x
```

### Restarting a specific worker node

To restart a single worker without bringing down the whole cluster:

```bash
docker restart inference_worker_2
```

The worker will reconnect to the Ray cluster automatically on startup. Deployments that were running on it will be briefly unavailable and then rescheduled by Ray Serve once the node rejoins.

---

For registering and activating models on the cluster, see [Model Activation](/docs/admin-model-activation).
For GPU memory configuration and model families, see [vLLM](/docs/admin-vllm).