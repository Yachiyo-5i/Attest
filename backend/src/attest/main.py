from __future__ import annotations

import os

import uvicorn


def main() -> None:
    host = os.getenv("ATTEST_HOST", "0.0.0.0")
    port = int(os.getenv("ATTEST_PORT", "8321"))
    uvicorn.run("attest.api:app", host=host, port=port)


if __name__ == "__main__":
    main()
