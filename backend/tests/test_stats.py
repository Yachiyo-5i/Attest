from attest.statistics import bootstrap_jsd, distribution, jsd


def test_identical_distributions_have_zero_jsd():
    p = distribution(["a", "a", "b"], ["a", "b"])
    assert jsd(p, p) == 0


def test_different_distributions_have_positive_jsd():
    assert jsd({"a": 1.0}, {"b": 1.0}) > 0.9


def test_bootstrap_is_deterministic():
    first = bootstrap_jsd(["a", "a", "b"], ["a", "b", "b"], ["a", "b"], "run-1", rounds=50)
    second = bootstrap_jsd(["a", "a", "b"], ["a", "b", "b"], ["a", "b"], "run-1", rounds=50)
    assert first == second
