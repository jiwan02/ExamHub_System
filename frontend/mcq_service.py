import os
import re
import random
import json
from collections import Counter

import pdfplumber
from flask import Flask, request, jsonify
from flask_cors import CORS
import spacy
from nltk.corpus import wordnet as wn
import nltk

# Ensure NLTK WordNet is available
try:
    nltk.data.find("corpora/wordnet")
except LookupError:
    nltk.download("wordnet", quiet=True)
try:
    nltk.data.find("corpora/omw-1.4")
except LookupError:
    nltk.download("omw-1.4", quiet=True)

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError as e:
    raise SystemExit(
        "spaCy model 'en_core_web_sm' is not installed.\n"
        "Install it with: python -m spacy download en_core_web_sm\n"
        f"Original error: {e}"
    )

app = Flask(__name__)
CORS(app)

# Constants
NOUN_POS = {"NOUN", "PROPN"}
WORD_RE = re.compile(r"[A-Za-z][A-Za-z\-']{2,}")
CLEAN_RE = re.compile(r"\(cid:\d+\)|[\n\r]+|\s{2,}")

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract and clean text from a PDF."""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        text = CLEAN_RE.sub(" ", text).strip()
        return text
    except Exception as e:
        print(f"[PDF] Extraction error: {e}")
        return ""

def normalize_token(token: str) -> str:
    """Normalize token by removing non-alphanumeric chars and converting to lowercase."""
    return re.sub(r"\W+", "", token).lower()

def pick_main_noun(noun_tokens):
    """Select the most salient noun based on frequency and context."""
    if not noun_tokens:
        return None
    lemmas = [normalize_token(tok.lemma_) for tok in noun_tokens]
    if not lemmas:
        return None
    lemma_counts = Counter(lemmas)
    most_common = lemma_counts.most_common(1)[0][0]
    candidates = [tok for tok in noun_tokens if normalize_token(tok.lemma_) == most_common]
    for tok in candidates:
        if len(tok.text) > 3 and WORD_RE.fullmatch(tok.text):
            return tok
    return candidates[0] if candidates else None

def make_cloze(sentence: str, target: str) -> str:
    """Replace the first occurrence of the target with a blank and clean the stem."""
    if not target:
        return sentence
    pattern = re.compile(rf"\b{re.escape(target)}\b", flags=re.IGNORECASE)
    cloze = pattern.sub("_________", sentence, count=1).strip()
    # Remove parenthetical text and redundant answer phrases after the blank
    cloze = re.sub(r"\s*\([^)]+\)", "", cloze).strip()
    # Remove the exact answer phrase (case-insensitive) after the blank
    answer_pattern = re.compile(rf"\b{re.escape(target)}\b", flags=re.IGNORECASE)
    parts = cloze.split("_________")
    if len(parts) == 2:
        # Clean the part after the blank to avoid repeating the answer
        parts[1] = answer_pattern.sub("", parts[1]).strip()
        parts[1] = re.sub(r"\s{2,}", " ", parts[1]).strip()
        cloze = "_________".join(parts).strip()
    return cloze

def gather_distractors(noun_tokens, answer_lemma: str, answer_text: str, num_distractors: int = 3, doc=None):
    """Gather distractors from sentence nouns, document nouns, and WordNet."""
    distractors = []
    seen = {answer_text.lower()}
    # Avoid partial matches of the answer in distractors
    answer_parts = set(normalize_token(w) for w in answer_text.split())

    # 1. Sentence-based distractors
    for tok in noun_tokens:
        lemma = normalize_token(tok.lemma_)
        if (lemma != answer_lemma and 
            WORD_RE.fullmatch(tok.text) and 
            tok.text.lower() not in seen and 
            normalize_token(tok.text) not in answer_parts):
            distractors.append(tok.text)
            seen.add(tok.text.lower())
    
    # 2. Document-wide nouns
    if len(distractors) < num_distractors and doc:
        doc_nouns = [t.text for t in doc if t.pos_ in NOUN_POS and 
                     t.is_alpha and 
                     t.text.lower() not in seen and 
                     normalize_token(t.text) not in answer_parts]
        random.shuffle(doc_nouns)
        for noun in doc_nouns:
            if WORD_RE.fullmatch(noun):
                distractors.append(noun)
                seen.add(noun.lower())
            if len(distractors) >= num_distractors:
                break
    
    # 3. WordNet synonyms
    if len(distractors) < num_distractors:
        synonyms = []
        for syn in wn.synsets(answer_text.lower(), pos="n"):
            for lemma in syn.lemmas():
                name = lemma.name().replace("_", " ")
                if (name.lower() not in seen and 
                    normalize_token(name) not in answer_parts and 
                    WORD_RE.fullmatch(name)):
                    synonyms.append(name)
                    seen.add(name.lower())
            if len(synonyms) >= num_distractors - len(distractors):
                break
        random.shuffle(synonyms)
        distractors.extend(synonyms[:num_distractors - len(distractors)])
    
    # 4. WordNet hypernyms
    if len(distractors) < num_distractors:
        hypernyms = []
        for syn in wn.synsets(answer_text.lower(), pos="n"):
            for hyper in syn.hypernyms():
                for lemma in hyper.lemmas():
                    name = lemma.name().replace("_", " ")
                    if (name.lower() not in seen and 
                        normalize_token(name) not in answer_parts and 
                        WORD_RE.fullmatch(name)):
                        hypernyms.append(name)
                        seen.add(name.lower())
        random.shuffle(hypernyms)
        distractors.extend(hypernyms[:num_distractors - len(distractors)])
    
    return distractors[:num_distractors]

def sentence_to_mcq(sent_doc, doc, num_distractors=3):
    """Convert a spaCy sentence into an MCQ."""
    noun_tokens = [t for t in sent_doc if t.pos_ in NOUN_POS and t.is_alpha]
    if len(noun_tokens) < 2:
        return None
    
    main_tok = pick_main_noun(noun_tokens)
    if not main_tok:
        return None
    
    answer_text = main_tok.text
    answer_lemma = normalize_token(main_tok.lemma_)
    
    # Create cloze-style question
    stem = make_cloze(sent_doc.text.strip(), answer_text)
    if len(stem.split()) < 8 or "_________" not in stem:
        return None
    
    # Gather distractors
    distractors = gather_distractors(noun_tokens, answer_lemma, answer_text, num_distractors, doc)
    if len(distractors) < num_distractors:
        return None
    
    # Build options
    options = distractors + [answer_text]
    random.shuffle(options)
    correct_idx = options.index(answer_text)
    
    return {
        "Question": stem,
        "Options": options,
        "CorrectAnswer": answer_text,
        "CorrectOptionIndex": correct_idx
    }

def generate_mcqs_from_text(text: str, num_questions: int = 5):
    """Generate MCQs from input text."""
    if not text or len(text) < 100:
        return []
    
    text = CLEAN_RE.sub(" ", text).strip()
    doc = nlp(text)
    sentences = [s for s in doc.sents if len(s.text.strip().split()) > 10 and 
                 len([t for t in s if t.pos_ in NOUN_POS]) > 2]
    if not sentences:
        return []
    
    random.shuffle(sentences)
    mcqs = []
    for sent in sentences:
        if len(mcqs) >= num_questions:
            break
        mcq = sentence_to_mcq(sent, doc, num_distractors=3)
        if mcq:
            mcqs.append(mcq)
    
    return mcqs

@app.route("/generate-mcq", methods=["POST"])
def generate_mcq_endpoint():
    """Generate MCQs from a PDF file, returning a flat list."""
    try:
        data = request.get_json(silent=True) or {}
        pdf_path = data.get("PdfPath")
        num_questions = int(data.get("NumberOfQuestions", 5))
        
        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({"error": "PDF file not found", "details": "Invalid or missing PdfPath"}), 400
        
        text = extract_text_from_pdf(pdf_path)
        if not text:
            return jsonify({"error": "No text extracted from PDF", "details": "PDF may be empty or unreadable"}), 400
        
        mcqs = generate_mcqs_from_text(text, num_questions)
        if not mcqs:
            return jsonify({"error": "No questions could be generated", "details": "Insufficient suitable content in PDF"}), 400
        
        return jsonify(mcqs), 200
    
    except Exception as e:
        return jsonify({"error": "Server error", "details": str(e)}), 500

@app.route("/evaluate-mcq", methods=["POST"])
def evaluate_mcq():
    try:
        answers = request.get_json(silent=True) or []
        print("Received payload:", answers)
        
        if not isinstance(answers, list):
            return jsonify({"error": "Invalid payload", "details": "Payload must be a list of answer objects"}), 400
        
        for ans in answers:
            if not isinstance(ans, dict) or "selectedOptionIndex" not in ans or "correctOptionIndex" not in ans:
                return jsonify({"error": "Invalid answer format", "details": "Each answer must have selectedOptionIndex and correctOptionIndex"}), 400
            if not isinstance(ans["correctOptionIndex"], int):
                return jsonify({"error": "Invalid answer types", "details": "correctOptionIndex must be an integer"}), 400
            # Allow null or integer for selectedOptionIndex
            if ans["selectedOptionIndex"] is not None and not isinstance(ans["selectedOptionIndex"], int):
                return jsonify({"error": "Invalid answer types", "details": "selectedOptionIndex must be an integer or null"}), 400
        
        score = sum(1 for ans in answers if ans["selectedOptionIndex"] is not None and ans["selectedOptionIndex"] == ans["correctOptionIndex"])
        return jsonify({"score": score, "total": len(answers)}), 200
    except Exception as e:
        print("Evaluation error:", str(e))
        return jsonify({"error": "Evaluation error", "details": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "running"})

if __name__ == "__main__":
    print("Starting MCQ Generator on http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=False, use_reloader=False)