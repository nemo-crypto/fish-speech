import asyncio
from types import SimpleNamespace

import httpx
import pytest
from kui.asgi import HTTPException, Kui

from tools.server.exception_handler import ExceptionHandler
from tools.server.views import routes


@pytest.mark.parametrize(
    "old,new,status",
    [
        ("speaker", "renamed\n", 400),
        ("speaker\n", "renamed", 400),
        ("speaker", "../renamed", 400),
        ("speaker", "renamed", 200),
    ],
)
def test_rename_validates_entire_ids_before_mutation(
    tmp_path, monkeypatch, old, new, status
):
    monkeypatch.chdir(tmp_path)
    original = tmp_path / "references" / old
    original.mkdir(parents=True)
    (original / "sample.lab").write_text("Hello")
    cache = {old: (["tokens"], ["Hello"])}
    app = Kui(
        routes=routes,
        exception_handlers={HTTPException: ExceptionHandler().http_exception_handler},
    )
    app.state.model_manager = SimpleNamespace(
        tts_inference_engine=SimpleNamespace(ref_by_id=cache)
    )

    async def invoke():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.post(
                "/v1/references/update",
                json={"old_reference_id": old, "new_reference_id": new},
            )

    response = asyncio.run(invoke())
    assert response.status_code == status
    if status == 400:
        assert original.is_dir()
        assert list(cache) == [old]
        assert len(list(original.parent.iterdir())) == 1
    else:
        assert not original.exists()
        assert (original.parent / new / "sample.lab").read_text() == "Hello"
        assert list(cache) == [new]
