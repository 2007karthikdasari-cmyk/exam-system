// Timer functionality
let timerInterval;
let timeRemaining;

function startTimer(duration, examId) {
    timeRemaining = duration * 60;

    timerInterval = setInterval(() => {
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            autoSubmitExam(examId);
        } else {
            timeRemaining--;
            updateTimerDisplay();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timerElement = document.getElementById('timer');

    if (timerElement) {
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (timeRemaining <= 60) {
            timerElement.classList.add('timer-danger');
        }
    }
}

// Auto-submit exam
function autoSubmitExam(examId) {
    const form = document.getElementById('examForm');
    if (form) {
        form.submit();
    } else {
        $.ajax({
            url: '/user/exam/auto-submit',
            method: 'POST',
            data: { examId: examId },
            success: function(response) {
                alert('Time\'s up! Exam auto-submitted.');
                window.location.href = '/user/dashboard';
            }
        });
    }
}

// Save answer locally
function saveAnswer(questionId, answer) {
    localStorage.setItem(`q_${questionId}`, answer);
    markQuestionAnswered(questionId);
}

function markQuestionAnswered(questionId) {
    const btn = document.querySelector(`.question-btn[data-qid="${questionId}"]`);
    if (btn) {
        btn.classList.add('answered');
    }
}

// Load saved answers
function loadSavedAnswers() {
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        const questionId = radio.name.split('_')[1];
        const savedAnswer = localStorage.getItem(`q_${questionId}`);
        if (savedAnswer && radio.value === savedAnswer) {
            radio.checked = true;
            markQuestionAnswered(questionId);
        }
    });
}

// Submit exam
function submitExam(examId, userId) {
    if (confirm('Are you sure you want to submit the exam?')) {
        const form = document.getElementById('examForm');
        const formData = new FormData(form);

        $.ajax({
            url: '/user/exam/submit',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                clearInterval(timerInterval);
                alert(`Exam submitted! Score: ${response.score}/${response.totalMarks} (${response.percentage}%)`);
                window.location.href = '/user/dashboard';
            },
            error: function(error) {
                alert('Error submitting exam. Please try again.');
            }
        });
    }
}