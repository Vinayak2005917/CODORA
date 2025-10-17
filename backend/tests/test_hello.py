pytest.ini
[pytest]
addopts = -v
testpaths = tests

tests/test_hello.py
def test_hello():
    assert 1 + 1 == 2