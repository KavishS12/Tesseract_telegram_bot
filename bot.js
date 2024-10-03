const TelegramBot = require('node-telegram-bot-api');

// Replace with your Bot Token from BotFather
const token = 'API_Token';
const bot = new TelegramBot(token, { polling: true });

const questions = [
  { id: 1, question: "What is the capital of France?", answer: "Paris" },
  { id: 2, question: "What is the capital of Japan?", answer: "Tokyo" },
  { id: 3, question: "What is the capital of India?", answer: "New Delhi" },
  { id: 4, question: "What is the capital of Brazil?", answer: "Brasilia" },
  { id: 5, question: "What is the capital of Australia?", answer: "Canberra" },
];

const userStates = {}; // Store user progress, scores, unanswered questions
const timers = {}; // Store timers for each user

async function initializeUser(chatId) {
  userStates[chatId] = {
    started : false,
    score: 0,
    answered: new Set(),
    currentQuestionIndex: 0,
    startTime: Date.now(),
  }; 
}

async function sendQuestion(chatId, questionIndex) {
  const question = questions[questionIndex];
  await bot.sendMessage(chatId, `Question ${question.id}: ${question.question}`);
}

function scheduleAllQuestions(chatId) {
  const questionIntervals = [2, 4, 6, 8]; // Send questions at these minute intervals
  questionIntervals.forEach((interval, index) => {
    const questionIndex = index + 1; // First question already sent
    const delay = interval * 60000; // Convert minutes to milliseconds

    timers[chatId] = setTimeout(() => {
      const user = userStates[chatId];

      // If question sent already(all previous questions up to this point are answered),skip this timeout
      if (user.currentQuestionIndex >= questionIndex) return;

      // If question not sent till now(unanswered questions exist), send the next scheduled question
      sendQuestion(chatId, questionIndex);
      user.currentQuestionIndex += 1;
    }, delay);
  });
}

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const user = userStates[chatId];
  const userAnswer = msg.text;
  
  if(!userAnswer.startsWith("/") && user && user.started){
    const [questionId, answer] = userAnswer.split(":").map(s => s.trim());

    if (questionId && answer) {
      const questionIndex = questions.findIndex(q => q.id === parseInt(questionId));
      if (questionIndex !== -1 && questionIndex <= userStates[chatId].currentQuestionIndex) {
        const question = questions[questionIndex];

        // Check if the question has already been answered
        if (user.answered.has(questionId)) {
          bot.sendMessage(chatId, `You've already answered question ${questionId}.`);
          return;
        }

        // Check if the user's answer is correct
        if (answer.toLowerCase() === question.answer.toLowerCase()) {
          bot.sendMessage(chatId, `Correct answer for question ${questionId}!`);

          // Update score and mark question as answered
          user.answered.add(questionId);
          user.score += 1;

          // Check if all previous questions are answered
          if (user.answered.size === user.currentQuestionIndex+1) {
            const nextQuestionIndex = user.currentQuestionIndex + 1;

            // Send the next question immediately if it is available
            if (nextQuestionIndex < questions.length) {
              setTimeout(()=>{
                sendQuestion(chatId, nextQuestionIndex);
                user.currentQuestionIndex = nextQuestionIndex; // Update current index
              },500)
            }
          }

          // Check if the user has answered all questions
          if (user.score === questions.length) {
            setTimeout(()=>{
              bot.sendMessage(chatId, `Congratulations! You answered all questions correctly!\n\nScore : ${user.score}`);
              clearTimers(chatId); // Stop any pending timers
            },2000)
          }
        } else {
          bot.sendMessage(chatId, `Incorrect answer for question ${questionId}. Try again!`);
        }
      } else if(questionIndex === -1) {
        bot.sendMessage(chatId, `Question ${questionId} doesn't exist! Please check the question number.`);
      } else if(questionIndex > userStates[chatId].currentQuestionIndex) {
        bot.sendMessage(chatId, `Question ${questionId} has not been activated yet!`);
      }
    } else {
      bot.sendMessage(chatId, "Please provide your answer in the format 'question_number: your_answer'.");
    }
  } else if(userAnswer.startsWith("/")){
    if(!['/start','/tesseract','/help','/dashboard'].includes(userAnswer)) {
      bot.sendMessage(chatId, "Command does not exist!");
    }
  } else if(!userAnswer.startsWith("/") && !user){
    bot.sendMessage(chatId, "Type '/start' to register yourself first!");
  } else if(!userAnswer.startsWith("/") && !user.started) {
    bot.sendMessage(chatId,"You haven't started the quiz yet .Type '/tesseract' to begin.")
  }
});

// Clear timers when the quiz is finished or reset
function clearTimers(chatId) {
  if (timers[chatId]) {
    clearTimeout(timers[chatId]);
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if(chatId in userStates){
    bot.sendMessage(chatId,"Already registered!")
    return;
  }
  bot.sendMessage(chatId,"Welcome to Tesseract! \nYou are now registered .Type '/tesseract' to begin the game");
  initializeUser(chatId);
});

bot.onText(/\/tesseract/, (msg) => {
  const chatId = msg.chat.id;
  const user = userStates[chatId];
  if(!user) {
    bot.sendMessage(chatId,"Type '/start' to register yourself first!");
    return;
  }
  if(user.started){
    bot.sendMessage(chatId,"Game has already started!")
    return;
  }
  user.started = true
  bot.sendMessage(chatId,"Game started!");
  setTimeout(()=>{
    // Send the first question
    sendQuestion(chatId, 0);
    // Schedule the remaining questions at their designated times
    scheduleAllQuestions(chatId);
  },500) 
});

const displayDashboard = (chatId,user) => {
  const score = user.score;
  const answeredQuestions = [...user.answered];
  let response = `Your current score is: ${score}\n\nCorrectly answered questions:\n`;
  if (answeredQuestions.length > 0) {
    answeredQuestions.forEach((id) => {
      response += `${id}\t`;
    });
  } else {
    response += "You haven't answered any questions yet.";
  }
  bot.sendMessage(chatId, response);
} 

bot.onText(/\/dashboard/, (msg) => {
  const chatId = msg.chat.id;
  const user = userStates[chatId];

  if (!user){
    bot.sendMessage(chatId, "Type '/start' to register yourself first!");
    return;
  } else if (!user.started){
    bot.sendMessage(chatId, "You haven't started the quiz yet. Type '/tesseract' to begin.");
    return;
  }
  displayDashboard(chatId,user);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
    bot.sendMessage(chatId,"/help : Command panel\n/start : User registration\n/tesseract : Begin the game\n/dashboard : Get your current score and progress");
});

