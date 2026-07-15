import pytest
import json
import re

# Helper to register stable mocks
def mock_repo_api(direct_vm, owner, repo, status=200, fork=False, archived=False, default_branch="main", languages=None):
    if languages is None:
        languages = {"Python": 1000}
    meta_body = json.dumps({
        "name": repo,
        "description": "Mock repo description",
        "fork": fork,
        "archived": archived,
        "default_branch": default_branch
    })
    direct_vm.mock_web(
        rf"api\.github\.com/repos/{owner}/{repo}$",
        {"status": status, "body": meta_body}
    )
    direct_vm.mock_web(
        rf"api\.github\.com/repos/{owner}/{repo}/languages$",
        {"status": status, "body": json.dumps(languages)}
    )

def mock_manifest_api(direct_vm, owner, repo, branch, skill, status=200, content=None):
    if content is None:
        if skill == "React":
            content = json.dumps({"dependencies": {"react": "18.2.0"}})
        elif skill == "Rust":
            content = "[dependencies]\ntokio = \"1.0\""
        else:
            content = ""
            
    if skill == "React":
        direct_vm.mock_web(
            rf"raw\.githubusercontent\.com/{owner}/{repo}/{branch}/package\.json$",
            {"status": status, "body": content}
        )
    elif skill == "Rust":
        direct_vm.mock_web(
            rf"raw\.githubusercontent\.com/{owner}/{repo}/{branch}/Cargo\.toml$",
            {"status": status, "body": content}
        )

# --- 1. Repository Counts ---
def test_valid_request_1_repo(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.check_pickling = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    req_id = contract.request_verification("Python", "user", "https://github.com/user/repo-1", "", "")
    assert req_id == 1
    req_json = json.loads(contract.get_request(1))
    assert req_json["repo_url_1"] == "https://github.com/user/repo-1"
    assert req_json["repo_url_2"] == ""
    assert req_json["repo_url_3"] == ""

def test_valid_request_2_repos(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    req_id = contract.request_verification("Python", "user", "https://github.com/user/repo-1", "https://github.com/user/repo-2", "")
    assert req_id == 1
    req_json = json.loads(contract.get_request(1))
    assert req_json["repo_url_1"] == "https://github.com/user/repo-1"
    assert req_json["repo_url_2"] == "https://github.com/user/repo-2"
    assert req_json["repo_url_3"] == ""

def test_valid_request_3_repos(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    req_id = contract.request_verification("Python", "user", "https://github.com/user/repo-1", "https://github.com/user/repo-2", "https://github.com/user/repo-3")
    assert req_id == 1
    req_json = json.loads(contract.get_request(1))
    assert req_json["repo_url_1"] == "https://github.com/user/repo-1"
    assert req_json["repo_url_2"] == "https://github.com/user/repo-2"
    assert req_json["repo_url_3"] == "https://github.com/user/repo-3"

# --- 2. Allowed Skills ---
@pytest.mark.parametrize("skill", ["React", "TypeScript", "Python", "Solidity", "Rust"])
def test_every_allowed_skill(direct_deploy, direct_vm, direct_alice, skill):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    req_id = contract.request_verification(skill, "user", "https://github.com/user/repo", "", "")
    req_json = json.loads(contract.get_request(req_id))
    assert req_json["skill"] == skill

def test_unknown_skill(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("not supported"):
        contract.request_verification("Go", "user", "https://github.com/user/repo", "", "")

# --- 3. Username Validation ---
def test_empty_username(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("username length"):
        contract.request_verification("Python", "", "https://github.com/user/repo", "", "")

def test_invalid_username_characters(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("format"):
        contract.request_verification("Python", "user_name", "https://github.com/user/repo", "", "")

def test_username_too_long(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    too_long = "a" * 40
    with direct_vm.expect_revert("username length"):
        contract.request_verification("Python", too_long, f"https://github.com/{too_long}/repo", "", "")

def test_username_starts_with_hyphen(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("format"):
        contract.request_verification("Python", "-user", "https://github.com/-user/repo", "", "")

def test_username_ends_with_hyphen(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("format"):
        contract.request_verification("Python", "user-", "https://github.com/user-/repo", "", "")

# --- 4. URL Validation Edge Cases ---
def test_non_https_url(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("HTTPS"):
        contract.request_verification("Python", "user", "http://github.com/user/repo", "", "")

def test_non_github_domain(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("hostname"):
        contract.request_verification("Python", "user", "https://gitlab.com/user/repo", "", "")

def test_github_lookalike_domain(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("hostname"):
        contract.request_verification("Python", "user", "https://github.com.example.com/user/repo", "", "")

def test_github_subdomain_forbidden(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("hostname"):
        contract.request_verification("Python", "user", "https://api.github.com/user/repo", "", "")

def test_url_containing_credentials(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("Credentials"):
        contract.request_verification("Python", "user", "https://token@github.com/user/repo", "", "")

def test_url_containing_custom_port(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("Credentials or custom ports"):
        contract.request_verification("Python", "user", "https://github.com:8443/user/repo", "", "")

def test_url_containing_query(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("Query parameters"):
        contract.request_verification("Python", "user", "https://github.com/user/repo?ref=main", "", "")

def test_url_containing_fragment(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("Fragments"):
        contract.request_verification("Python", "user", "https://github.com/user/repo#readme", "", "")

def test_url_containing_extra_path(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("exactly owner and repository"):
        contract.request_verification("Python", "user", "https://github.com/user/repo/issues", "", "")

def test_url_containing_control_characters(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("control or invalid"):
        contract.request_verification("Python", "user", "https://github.com/user/repo\n", "", "")

# --- 5. Repo List Constraints ---
def test_repository_owner_mismatch(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("owner does not match"):
        contract.request_verification("Python", "user1", "https://github.com/user2/repo", "", "")

def test_duplicate_repositories_case_insensitive(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("Duplicate repository"):
        contract.request_verification("Python", "user", "https://github.com/User/Repo", "https://github.com/user/repo", "")

def test_gap_between_repositories(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("Gap detected"):
        contract.request_verification("Python", "user", "https://github.com/user/repo1", "", "https://github.com/user/repo3")

def test_no_repositories(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("At least one"):
        contract.request_verification("Python", "user", "", "", "")

# --- 6. Active Request Guard ---
def test_duplicate_active_request(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    with direct_vm.expect_revert("already has an active request"):
        contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")

# --- 7. Request Lifecycle Reads ---
def test_unknown_request_id(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("does not exist"):
        contract.get_request(99)

def test_negative_and_zero_request_id(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    with direct_vm.expect_revert("positive integer"):
        contract.get_request(0)
    with direct_vm.expect_revert("positive integer"):
        contract.get_request(-5)

def test_evaluate_already_finalized_request(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    
    mock_repo_api(direct_vm, "user", "repo")
    mock_manifest_api(direct_vm, "user", "repo", "main", "Python")
    
    llm_payload = {"verdict": "SUPPORTED", "reason": "Excellent proficiency.", "evidence_signals": ["python skill"]}
    direct_vm.mock_llm(r"Python", json.dumps(llm_payload))
    
    contract.evaluate_request(1)
    
    with direct_vm.expect_revert("not in SUBMITTED state"):
        contract.evaluate_request(1)

# --- 8. Web Fetch Errors & Responses ---
def test_github_metadata_success(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    from genlayer.py.types import Address
    alice_addr = Address(direct_alice)
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    mock_repo_api(direct_vm, "user", "repo", default_branch="main")
    
    llm_payload = {"verdict": "SUPPORTED", "reason": "Python proficiency is clear.", "evidence_signals": ["python signal"]}
    direct_vm.mock_llm(r"Python", json.dumps(llm_payload))
    
    res = contract.evaluate_request(1)
    res_json = json.loads(res)
    assert res_json["status"] == "FINALIZED"
    assert res_json["verdict"] == "SUPPORTED"
    assert "Mock repo description" in res_json["evidence_summary"]
    assert res_json["owner"] == alice_addr.as_hex

def test_github_404(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    
    direct_vm.mock_web(r"api\.github\.com/repos/user/repo$", {"status": 404, "body": "{}"})
    direct_vm.mock_web(r"api\.github\.com/repos/user/repo/languages$", {"status": 404, "body": "{}"})
    
    res = contract.evaluate_request(1)
    res_json = json.loads(res)
    assert res_json["verdict"] == "INCONCLUSIVE"
    assert "Repository not found" in res_json["evidence_summary"]

def test_github_timeout_rate_limit(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    
    direct_vm.mock_web(r"api\.github\.com/repos/user/repo$", {"status": 429, "body": "{}"})
    direct_vm.mock_web(r"api\.github\.com/repos/user/repo/languages$", {"status": 429, "body": "{}"})
    
    res = contract.evaluate_request(1)
    res_json = json.loads(res)
    assert res_json["verdict"] == "INCONCLUSIVE"
    assert "Rate limit exceeded" in res_json["evidence_summary"]

def test_missing_optional_manifest(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("React", "user", "https://github.com/user/repo", "", "")
    
    mock_repo_api(direct_vm, "user", "repo", default_branch="main")
    direct_vm.mock_web(r"raw\.githubusercontent\.com/user/repo/main/package\.json$", {"status": 404, "body": "{}"})
    
    llm_payload = {"verdict": "INSUFFICIENT_EVIDENCE", "reason": "No react deps.", "evidence_signals": []}
    direct_vm.mock_llm(r"React", json.dumps(llm_payload))
    
    res = contract.evaluate_request(1)
    res_json = json.loads(res)
    assert res_json["verdict"] == "INSUFFICIENT_EVIDENCE"
    assert "package.json not found" in res_json["evidence_summary"]

def test_non_main_default_branch(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("React", "user", "https://github.com/user/repo", "", "")
    
    mock_repo_api(direct_vm, "user", "repo", default_branch="develop")
    mock_manifest_api(direct_vm, "user", "repo", "develop", "React")
    
    llm_payload = {"verdict": "SUPPORTED", "reason": "React package found on develop.", "evidence_signals": ["react"]}
    direct_vm.mock_llm(r"React", json.dumps(llm_payload))
    
    res = contract.evaluate_request(1)
    res_json = json.loads(res)
    assert res_json["verdict"] == "SUPPORTED"

# --- 9. LLM Output Validation & Payload Rejection ---
def test_malformed_llm_json(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    mock_repo_api(direct_vm, "user", "repo")
    direct_vm.mock_llm(r"Python", "not valid json")
    
    with direct_vm.expect_revert("not a valid JSON string"):
        contract.evaluate_request(1)

def test_missing_result_fields(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    mock_repo_api(direct_vm, "user", "repo")
    direct_vm.mock_llm(r"Python", json.dumps({"verdict": "SUPPORTED", "reason": "proficiency"}))
    
    with direct_vm.expect_revert("do not match exactly"):
        contract.evaluate_request(1)

def test_forbidden_terms_in_reason(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    mock_repo_api(direct_vm, "user", "repo")
    
    llm_payload = {"verdict": "SUPPORTED", "reason": "We verified code ownership of the developer.", "evidence_signals": ["python"]}
    direct_vm.mock_llm(r"Python", json.dumps(llm_payload))
    
    with direct_vm.expect_revert("forbidden claim"):
        contract.evaluate_request(1)

def test_overlong_reason(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    mock_repo_api(direct_vm, "user", "repo")
    
    long_reason = "a" * 801
    llm_payload = {"verdict": "SUPPORTED", "reason": long_reason, "evidence_signals": ["python"]}
    direct_vm.mock_llm(r"Python", json.dumps(llm_payload))
    
    with direct_vm.expect_revert("exceeds 800 characters limit"):
        contract.evaluate_request(1)

# --- 10. Consensus and State Rollback ---
def test_validator_agreement(direct_deploy, direct_vm, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    mock_repo_api(direct_vm, "user", "repo")
    
    llm_payload = {"verdict": "SUPPORTED", "reason": "Python logic is present.", "evidence_signals": ["python"]}
    direct_vm.mock_llm(r"Python", json.dumps(llm_payload))
    
    contract.evaluate_request(1)
    assert direct_vm.run_validator() is True

def test_validator_disagreement_rollback(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    mock_repo_api(direct_vm, "user", "repo")
    direct_vm.mock_llm(r"Python", json.dumps({"verdict": "SUPPORTED", "reason": "Proficient.", "evidence_signals": ["python"]}))
    
    snap = direct_vm.snapshot()
    contract.evaluate_request(1)
    
    direct_vm.clear_mocks()
    mock_repo_api(direct_vm, "user", "repo")
    direct_vm.mock_llm(r"Python", json.dumps({"verdict": "NOT_SUPPORTED", "reason": "No logic.", "evidence_signals": []}))
    
    is_agree = direct_vm.run_validator()
    assert is_agree is False
    
    if not is_agree:
        direct_vm.revert(snap)
        
    req_json = json.loads(contract.get_request(1))
    assert req_json["status"] == "SUBMITTED"

# --- 11. Bounded Attestation Indices ---
def test_bounded_attestations_newest_first_and_capped(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    from genlayer.py.types import Address
    alice_addr = Address(direct_alice)
    
    for i in range(1, 61):
        contract.request_verification("Python", "user", f"https://github.com/user/repo-{i}", "", "")
        
        mock_repo_api(direct_vm, "user", f"repo-{i}")
        direct_vm.mock_llm(r"Python", json.dumps({"verdict": "SUPPORTED", "reason": "Proficient.", "evidence_signals": ["python"]}))
        contract.evaluate_request(i)
        direct_vm.clear_mocks()
        
    att_str = contract.get_attestations(alice_addr.as_hex)
    att_list = json.loads(att_str)
    
    assert len(att_list) == 50
    assert att_list[0]["request_id"] == 60
    assert att_list[-1]["request_id"] == 11

# --- 12. Correction 2 Regression Tests ---
def test_url_exceeds_200_chars(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    long_url = "https://github.com/user/" + ("a" * 180)
    assert len(long_url) > 200
    with direct_vm.expect_revert("exceeds 200 characters limit"):
        contract.request_verification("Python", "user", long_url, "", "")

def test_finalized_request_written_to_index(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    from genlayer.py.types import Address
    alice_addr = Address(direct_alice)
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    mock_repo_api(direct_vm, "user", "repo")
    direct_vm.mock_llm(r"Python", json.dumps({"verdict": "SUPPORTED", "reason": "Proficient.", "evidence_signals": ["python"]}))
    
    contract.evaluate_request(1)
    
    # Check index counts
    count = int(contract.owner_finalized_request_count[alice_addr])
    assert count == 1
    req_id = int(contract.owner_finalized_request_by_index[f"{alice_addr.as_hex}:0"])
    assert req_id == 1

def test_submitted_request_not_in_attestations(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    from genlayer.py.types import Address
    alice_addr = Address(direct_alice)
    
    contract.request_verification("Python", "user", "https://github.com/user/repo", "", "")
    
    att_str = contract.get_attestations(alice_addr.as_hex)
    att_list = json.loads(att_str)
    assert len(att_list) == 0

def test_pending_request_does_not_affect_finalized_index(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    from genlayer.py.types import Address
    alice_addr = Address(direct_alice)
    
    # 1. Finalize first request
    contract.request_verification("Python", "user", "https://github.com/user/repo1", "", "")
    mock_repo_api(direct_vm, "user", "repo1")
    direct_vm.mock_llm(r"Python", json.dumps({"verdict": "SUPPORTED", "reason": "Proficient.", "evidence_signals": ["python"]}))
    contract.evaluate_request(1)
    direct_vm.clear_mocks()
    
    # 2. Submit second request but leave it SUBMITTED (pending)
    contract.request_verification("Python", "user", "https://github.com/user/repo2", "", "")
    
    # 3. Get attestations - should only contain the finalized request
    att_str = contract.get_attestations(alice_addr.as_hex)
    att_list = json.loads(att_str)
    assert len(att_list) == 1
    assert att_list[0]["request_id"] == 1

def test_owner_isolation(direct_deploy, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/talent_verify.py")
    from genlayer.py.types import Address
    alice_addr = Address(direct_alice)
    bob_addr = Address(direct_bob)
    
    # Alice submits and finalizes
    contract.request_verification("Python", "user", "https://github.com/user/repo1", "", "")
    mock_repo_api(direct_vm, "user", "repo1")
    direct_vm.mock_llm(r"Python", json.dumps({"verdict": "SUPPORTED", "reason": "Proficient.", "evidence_signals": ["python"]}))
    contract.evaluate_request(1)
    direct_vm.clear_mocks()
    
    # Get attestations for Alice
    alice_att = json.loads(contract.get_attestations(alice_addr.as_hex))
    assert len(alice_att) == 1
    
    # Get attestations for Bob (should be empty)
    bob_att = json.loads(contract.get_attestations(bob_addr.as_hex))
    assert len(bob_att) == 0
