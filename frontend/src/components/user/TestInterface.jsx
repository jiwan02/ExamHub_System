import React, { useState, useEffect } from "react";
import { studyService } from "../../services/studyService";
import { CheckCircle, XCircle, RotateCcw, Clock, Award } from "lucide-react";

const TestInterface = ({ studyMaterialId, studyMaterialTitle, onClose }) => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [testStarted, setTestStarted] = useState(false);

  useEffect(() => {
    generateTest();
  }, [studyMaterialId]);

  useEffect(() => {
    let timer;
    if (testStarted && timeLeft > 0 && !showResults) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && !showResults) {
      handleSubmitTest();
    }
    return () => clearTimeout(timer);
  }, [timeLeft, testStarted, showResults]);

  const generateTest = async () => {
    try {
      setLoading(true);
      const { data } = await studyService.generateTest(studyMaterialId);
      setQuestions(data);
      setSelectedAnswers(new Array(data.length).fill(-1));
      setTestStarted(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate test");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = answerIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmitTest = async () => {
    try {
      const answers = selectedAnswers.map((answer) =>
        answer !== -1 ? answer : 0
      );
      console.log(
        "Submitting payload:",
        JSON.stringify(
          {
            studyMaterialId: Number(studyMaterialId),
            answers,
          },
          null,
          2
        )
      );

      const { data } = await studyService.submitTest({
        studyMaterialId: Number(studyMaterialId),
        answers,
      });

      console.log("Submission response:", JSON.stringify(data, null, 2));
      const scoreValue = data.Score ?? 0;
      setScore(scoreValue);
      setShowResults(true);
    } catch (err) {
      console.error(
        "Submission error:",
        JSON.stringify(err.response?.data || err.message, null, 2)
      );
      setError(
        err.response?.data?.message ||
          "Failed to submit test. Please try again."
      );
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score, total) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Generating Test
            </h3>
            <p className="text-gray-600">
              Please wait while we create questions from the study material...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Test Submission Failed
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex space-x-3">
              <button
                onClick={handleSubmitTest}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Try Again</span>
              </button>
              <button
                onClick={onClose}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-8">
            <Award className="h-16 w-16 text-purple-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Test Completed!
            </h2>
            <p className="text-gray-600 mb-4">{studyMaterialTitle}</p>
          </div>

          <div className="space-y-6">
            {questions.map((question, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4"
              >
                <p className="font-medium text-gray-900 mb-3">
                  {index + 1}. {question.question}
                </p>
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className={`p-2 rounded flex items-center space-x-2 ${
                        optionIndex === question.correctOptionIndex
                          ? "bg-green-100 text-green-800"
                          : selectedAnswers[index] === optionIndex
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-50"
                      }`}
                    >
                      {optionIndex === question.correctOptionIndex ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : selectedAnswers[index] === optionIndex ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                      <span>{option}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Close Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Question {currentQuestion + 1} of {questions.length}
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock className="h-5 w-5" />
            <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-lg font-medium text-gray-900 mb-6">
            {currentQ.question}
          </p>

          <div className="space-y-3">
            {currentQ.options.map((option, index) => (
              <label
                key={index}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedAnswers[currentQuestion] === index
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion}`}
                  value={index}
                  checked={selectedAnswers[currentQuestion] === index}
                  onChange={() => handleAnswerSelect(index)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-3 ${
                    selectedAnswers[currentQuestion] === index
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300"
                  }`}
                >
                  {selectedAnswers[currentQuestion] === index && (
                    <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                  )}
                </div>
                <span className="text-gray-900">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={handlePreviousQuestion}
            disabled={currentQuestion === 0}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex space-x-3">
            {currentQuestion === questions.length - 1 ? (
              <button
                onClick={handleSubmitTest}
                className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Submit Test
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestInterface;
