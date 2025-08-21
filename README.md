# Simple Proxy Service

This is a simple proxy service, which proxies any POST request coming in to downstream server.

Following are the technical requirements:

1. The proxy expects a json request body
2. The json body should always contain a key called "user" else it should throw an error and return 400
3. The proxy expects a json response body from downstream server
4. The response json body should always contain a key called "user" else it should throw an error and return 400.
5. The "user" key from the response body will be removed

## Requirements:

1. Python version: 3.12
2. uv installed: https://docs.astral.sh/uv/getting-started/installation/
3. `uv sync`to create and install dependencies
4. Service configuration can be found in `config.py`

## Run the service:

```
uv run main.py
```

You should see following:

```
INFO: Started server process [50724]
INFO: Waiting for application startup.
INFO: Application startup complete.
INFO: Uvicorn running on http://localhost:8000 (Press CTRL+C to quit)
```

## Example:

```
POST http://localhost:8000/api/login
Request Body:
{
    "user": 40,
    "password": "12345"
}

Response Body:
{
  "token": "abc123xyz",
  "expires_in": 3600
}
```

## Exercise

1. Please write automation tests for the above requirements. You can use any langugage or framework you are comfortable in.

2. Please also propose how can this service be tested manually.

## Tips:

1. What is a proxy: https://en.wikipedia.org/wiki/Proxy_server
2. You might need to create a downstream service for your testing ( see `config.py`, `PROXY_TARGET_HOST` and `PROXY_TARGET_PORT` to configure proxy to connect to downstream service)
