
const options = document.querySelectorAll(".quiz-option");
const overlay = document.getElementById("quizOverlay");
const resultTitle = document.getElementById("resultTitle");
const resultDescription = document.getElementById("resultDescription");
const resultButton = document.getElementById("resultButton");
const resultIcon = document.getElementById("resultIcon");

let isWaiting = false;

options.forEach(button => {
  button.addEventListener("click", () => {
    // 2초 대기 중에는 다른 카드 선택 불가
    if (isWaiting) return;

    isWaiting = true;

    const isCorrect = button.dataset.answer === "학교";

    // 기존 선택 상태 초기화
    options.forEach(option => {
      option.classList.remove("selected", "correct", "wrong");
    });

    // 1. 선택한 카드에 정답/오답 색상 표시
    button.classList.add(isCorrect ? "correct" : "wrong");

    // 2. 2초 후 바텀시트 표시
    setTimeout(() => {
      overlay.classList.toggle("is-wrong", !isCorrect);

      if (isCorrect) {
        resultIcon.textContent = "✓";
        resultTitle.textContent = "잘했어요!";
        resultDescription.textContent = "정확하게 맞혔어요!";
        resultButton.textContent = "다음으로";
      } else {
        resultIcon.textContent = "×";
        resultTitle.textContent = "다시 한번 해볼까요?";
        resultDescription.textContent =
          "동작을 천천히 확인하고 다시 선택해 보세요.";
        resultButton.textContent = "다시하기 ↻";
      }

      overlay.classList.add("show");
      overlay.setAttribute("aria-hidden", "false");

      isWaiting = false;

      resultButton.onclick = () => {
        if (isCorrect) {
          window.location.href = "./friend2.html";
          overlay.classList.remove("show");
        } else {
          overlay.classList.remove("show");

          // 오답일 경우 카드 초기화
          options.forEach(option => {
            option.classList.remove("selected", "correct", "wrong");
          });
        }

        overlay.setAttribute("aria-hidden", "true");
      };
    }, 800);
  });
});
