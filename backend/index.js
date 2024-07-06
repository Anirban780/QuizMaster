const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Quiz = require('./models/Quiz');

const QuizResult = require('./models/QuizResult');
const QuizProgress = require('./models/QuizProgress');

require('dotenv').config();

async function autoSubmitQuizzes() {
    try {
        const quizProgressList = await QuizProgress.find({ completed: false });

        for (const quizProgress of quizProgressList) {
            const quiz = await Quiz.findOne({ quiz_id: quizProgress.quiz_id });

            if (!quiz) continue;

            const elapsedTime = (Date.now() - quizProgress.lastUpdated.getTime()) / 1000; // Time in seconds

            if (quizProgress.elapsedTime + elapsedTime >= quiz.timeLimit * 60) {
                // Time limit reached, auto-submit quiz
                quizProgress.elapsedTime += elapsedTime;
                quizProgress.completed = true;

                let score = 0;
                const answersWithCorrectness = quizProgress.answers.map(answer => {
                    const question = quiz.questions.id(answer.question_id);
                    const isCorrect = question.correctAnswer === answer.selectedOption;
                    if (isCorrect) score += 1;
                    return {
                        ...answer,
                        isCorrect
                    };
                });

                // Check if quiz is already taken by this user
                const quizResultExists = await QuizResult.findOne({ quiz_id: quizProgress.quiz_id, user_id: quizProgress.user_id });
                if (quizResultExists) {
                    console.log(`Quiz ${quizProgress.quiz_id} already taken by user ${quizProgress.user_id}`);
                    continue; // Skip further processing
                }

                // Save QuizResult
                const quizResult = new QuizResult({
                    quiz_id: quizProgress.quiz_id,
                    user_id: quizProgress.user_id,
                    score,
                    answers: answersWithCorrectness
                });

                await quizResult.save();

                // Update Quiz takenBy if the user hasn't already taken it
                if (!quiz.takenBy.includes(quizProgress.user_id)) {
                    quiz.takenBy.push(quizProgress.user_id);
                    await quiz.save();
                }
                quizProgress.save();
            }
        }
    } catch (err) {
        console.error('Error in autoSubmitQuizzes:', err);
    }
    console.log('autoSubmitQuizzes ran');
}


// Periodically check every minute
setInterval(autoSubmitQuizzes, 60 * 1000);

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {  }) .catch(err => console.error('Error connecting to MongoDB:', err));

// Routes



app.use('/api/users', require('./routes/users'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/',(req,res)=>res.send('Hello World!'));
const PORT = process.env.PORT || 5000;
//print req res status
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

