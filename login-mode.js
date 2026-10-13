// 로그인 방식 선택은 Firebase 연결 여부와 관계없이 동작합니다.
function selectLoginMode(mode) {
  for (const role of ["viewer", "admin"]) {
    const selected = mode === role;
    document.getElementById(role + "-login-form").classList.toggle("hidden", !selected);
    const button = document.getElementById(role + "-mode-btn");
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("ghost", !selected);
  }
  document.getElementById("login-error").textContent = "";
  document.getElementById("viewer-login-error").textContent = "";
}
document.getElementById("viewer-mode-btn").onclick = () => selectLoginMode("viewer");
document.getElementById("admin-mode-btn").onclick = () => selectLoginMode("admin");
selectLoginMode("viewer");
