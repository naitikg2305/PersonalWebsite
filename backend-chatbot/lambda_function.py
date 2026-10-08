"""AWS Lambda entry point (Function URL). CORS is configured on the Function URL itself."""

import base64
import json

from chatbot import answer


def _json(status: int, payload: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }


def handler(event, context):
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    try:
        question = json.loads(body).get("query", "")
    except (json.JSONDecodeError, AttributeError):
        return _json(400, {"response": "Invalid request."})

    try:
        return _json(200, {"response": answer(question)})
    except Exception as e:  # log for CloudWatch, keep internals out of the response
        print(f"chat error: {e!r}")
        return _json(500, {"response": "Sorry, something went wrong. Please try again."})
