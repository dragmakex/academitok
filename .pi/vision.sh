#!/usr/bin/env bash
# Ask a screenshot what it actually shows.
#
#   .pi/vision.sh <prompt> <image> [max_tokens]
#
# Model choice is fixed: zai-org/GLM-5.3-Flash on the Swiss AI load balancer is
# the only model here that both sees images reliably and writes long answers
# (DeepSeek V4.1 Flash silently drops the image, Gemma-4 answers too briefly).
# GLM puts its thinking in `reasoning_content` and can leave `content` empty
# when the token budget is small, so the floor is 1400.
set -euo pipefail

PROMPT="${1:?usage: .pi/vision.sh <prompt> <image> [max_tokens]}"
IMAGE="${2:?usage: .pi/vision.sh <prompt> <image> [max_tokens]}"
MAX_TOKENS="${3:-1400}"
MODEL="RCP-AIaaS/zai-org/GLM-5.3-Flash"
KEY="$("$HOME/.local/bin/swissai-lb-key")"

python3 - "$PROMPT" "$IMAGE" "$MAX_TOKENS" "$MODEL" "$KEY" <<'PY'
import base64, json, sys, urllib.request

prompt, image, max_tokens, model, key = sys.argv[1:6]
data = base64.b64encode(open(image, "rb").read()).decode()
body = json.dumps({
    "model": model,
    "max_tokens": int(max_tokens),
    "messages": [{
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{data}"}},
        ],
    }],
}).encode()
request = urllib.request.Request(
    "http://127.0.0.1:2456/v1/chat/completions",
    data=body,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
)
try:
    response = json.load(urllib.request.urlopen(request, timeout=300))
except Exception as error:  # noqa: BLE001 - surfaced verbatim, the LB decides the message
    print(f"vision failed: {error}")
    raise SystemExit(1)

if "error" in response:
    print("vision failed:", response["error"].get("message", response["error"]))
    raise SystemExit(1)

message = response["choices"][0]["message"]
print((message.get("content") or message.get("reasoning_content") or "(no answer)").strip())
PY
