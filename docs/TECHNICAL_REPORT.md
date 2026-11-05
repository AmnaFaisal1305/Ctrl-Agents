# Student Helpdesk Email Classification — Technical Report

**Course:** CT-264 Programming for Artificial Intelligence
**Activity:** Complex Computing Activity (CCA) through Problem-Based Learning
**CLO 3 (C3):** Identify appropriate AI techniques to solve classification problems of moderate complexity.
**Institution:** NED University of Engineering and Technology — Department of Computer Science and Information Technology (BS CS, Cyber Security)

> This report documents the analysis layer only (`analysis/`). It is self-contained and does not depend on, or change, the triage agent, backend or frontend. Run instructions are in the project `README.md`; the agent design is in `docs/ARCHITECTURE.md`.

---

## 1. Problem Statement and Objectives

A university helpdesk receives a continuous stream of student emails — fee queries, hostel complaints, academic requests, IT issues, and sensitive messages such as harassment reports or wellbeing emergencies. Manually reading and routing every email is slow and inconsistent, and the most urgent messages (a hazard, a self-harm disclosure) can be buried under routine traffic.

**The AI problem.** Given the free text of a student email (subject + body), **predict its category** so it can be routed to the correct office automatically. This is a supervised **multi-class text classification** problem of moderate complexity: nine classes, short informal text, and real class imbalance.

**Objectives.**
1. Build a labelled dataset of student emails spanning all nine helpdesk categories.
2. Explore the data, quantify class imbalance, and understand the text.
3. Train and compare classical text classifiers that predict the category from raw text.
4. Evaluate them rigorously (held-out test set + cross-validation) and improve performance through tuning and ensembling.
5. Compare the trained classifier against the project's LLM-based agent and state honestly where each is the right tool.

**Real-world significance.** Correct, fast routing means urgent and sensitive cases reach a human quickly, routine cases get a consistent first response, and staff time is spent on judgement rather than sorting. The same category signal is what the production agent uses to decide escalation and which policy to cite.

**Inputs and outputs.**
- **Input:** `text` = email `subject` + `body` (free text, English and Roman Urdu).
- **Output:** `category` ∈ {`fee`, `hostel`, `academic`, `technical`, `wellbeing`, `harassment`, `legal_media`, `security`, `other`}.

---

## 2. Datasets

The rubric requires at least two datasets, or one large and suitable dataset. We use **two**, merged into one frame of **420 rows**.

### 2.1 Dataset 1 — Real emails (ground truth)

The 20 sample emails in `data/inbox/E*.json`, each with its category taken from the agent's `outbox.json`. These are small but real: they carry the natural noise of student writing — greetings, mixed English/Roman Urdu, HTML, and multi-issue messages. They anchor the analysis to genuine text.

| Field | Type | Description |
|---|---|---|
| `subject` | text | Email subject line |
| `body` | text | Email body (may contain Roman Urdu, HTML) |
| `category` | label | One of 9 classes (target) |
| `priority` | label | `low` / `medium` / `high` |
| `escalate` | bool | Whether a human must handle it |
| `source` | str | `real` |

### 2.2 Dataset 2 — Synthetic emails

`analysis/generate_data.py` programmatically generates **400 labelled emails** across all nine categories, with realistic Pakistani university context (student names, roll numbers like `CS-21xxx`, hostel blocks, course codes). Synthetic data is used because 20 real emails are far too few to train and cross-validate a nine-class model, and because real student emails are private. Each category is built from templates with randomised slots so the vocabulary and structure vary within a class.

### 2.3 Combined dataset

The two are concatenated (`source` distinguishes them) into **420 rows**. A single `text` column is formed from `subject + body` and is the only feature fed to the models.

| Property | Value |
|---|---|
| Total samples | 420 (20 real + 400 synthetic) |
| Classes | 9 |
| Mean word count | 35.6 words (min 7, max 53) |
| Escalation rate | 40.2% |

---

## 3. Methodology

```
 ┌──────────────┐     ┌──────────────┐
 │ Dataset 1    │     │ Dataset 2    │
 │ 20 real      │     │ 400 synthetic│
 │ (outbox.json)│     │ (generator)  │
 └──────┬───────┘     └──────┬───────┘
        └───────┬────────────┘
                ▼
        ┌───────────────┐
        │ Merge → 420   │  text = subject + body
        │ rows, 1 frame │  target = category
        └──────┬────────┘
               ▼
        ┌───────────────┐
        │ EDA           │  class balance, priority,
        │ (7 charts)    │  text length, top words
        └──────┬────────┘
               ▼
        ┌───────────────┐
        │ Preprocess    │  lowercase, strip punctuation,
        │               │  drop short tokens → clean_text
        └──────┬────────┘
               ▼
        ┌───────────────┐
        │ TF-IDF        │  unigrams+bigrams, max 5000
        │ vectoriser    │  (inside each pipeline)
        └──────┬────────┘
               ▼
    ┌──────────┴───────────┐
    ▼          ▼           ▼
 ┌──────┐  ┌───────┐  ┌────────┐
 │ LogR │  │  NB   │  │ LinSVM │   80/20 stratified split
 └──┬───┘  └───┬───┘  └───┬────┘
    └──────────┼──────────┘
               ▼
        ┌───────────────┐
        │ Evaluate      │  accuracy, F1-macro/weighted,
        │               │  report, confusion matrix,
        │               │  5-fold stratified CV
        └──────┬────────┘
               ▼
        ┌───────────────┐
        │ Improve       │  GridSearchCV tuning +
        │               │  hard-voting ensemble
        └──────┬────────┘
               ▼
        ┌───────────────┐
        │ Compare vs    │  classical ML vs LLM agent
        │ LLM agent     │  (capability radar)
        └───────────────┘
```

The whole pipeline lives in `analysis/eda.ipynb` (run top to bottom). It is deterministic (`random_state=42`) and uses only pandas, numpy, matplotlib, seaborn and scikit-learn — no external API call is made in the analysis.

---

## 4. Exploratory Data Analysis

Seven EDA charts are saved to `analysis/plots/`.

- **Category distribution** (`category_distribution.png`) — counts per class, overall and by source. The classes range from `academic` (76) down to `legal_media` / `security` (21 each).
- **Priority distribution** (`priority_distribution.png`) — `high` 202, `medium` 168, `low` 50; the inbox skews urgent because sensitive categories (harassment, wellbeing, hazards) are always high.
- **Class imbalance** (`class_imbalance.png`) — majority/minority highlighted; **imbalance ratio ≈ 3.6** (76 / 21). Moderate, not severe, but enough to hurt minority-class recall if ignored.
- **Text length** (`text_length.png`) — word counts are tight (mean 35.6, sd 6.4); emails are short, so TF-IDF over unigrams+bigrams is appropriate and deep sequence models are unnecessary.
- **Top words per category** (`word_frequency.png`) — each class has a clear, sensible vocabulary ("fee / voucher / installment" for `fee`; "wifi / portal / login" for `technical`), which is exactly what a linear classifier exploits.

**Class imbalance handling.** Imbalance is addressed in two ways: (1) `class_weight='balanced'` on Logistic Regression and Linear SVM, which up-weights minority classes in the loss; and (2) **F1-macro** as the primary metric and **stratified** splitting / cross-validation, so minority classes count equally and are represented in every fold. Naive Bayes uses `alpha=0.1` smoothing instead of class weights (it has no such parameter).

---

## 5. Preprocessing

Applied in the notebook to build `clean_text`:

1. **Combine** `subject` + `body` into one `text` field.
2. **Lowercase** all text.
3. **Remove punctuation** via a `str.translate` table.
4. **Drop very short tokens** (length ≤ 1) to cut noise.
5. **Vectorise** with `TfidfVectorizer(max_features=5000, ngram_range=(1,2), sublinear_tf=True)` inside each model pipeline, so the vectoriser is fit only on training folds and never leaks test data.

Missing values are handled at merge time (`subject`/`body` default to empty strings), so no row is dropped and every email produces a feature vector.

---

## 6. Models

Three classical text classifiers, each a scikit-learn `Pipeline` of TF-IDF → classifier, trained on an 80/20 **stratified** split (336 train / 84 test):

| Model | Why chosen | Key settings |
|---|---|---|
| **Logistic Regression** | Strong, well-calibrated linear baseline for sparse text; interpretable coefficients | `class_weight='balanced'`, `max_iter=1000` |
| **Multinomial Naive Bayes** | Classic, fast text baseline; strong when features are near-independent word counts | `alpha=0.1` |
| **Linear SVM** (`LinearSVC`) | Often best-in-class for high-dimensional sparse TF-IDF | `class_weight='balanced'` |

These are appropriate for the problem's *moderate complexity*: short text, clear per-class vocabulary, a few hundred samples. Deep models (RNN/Transformer) would be overkill and would overfit this volume.

---

## 7. Results

### 7.1 Held-out test set (84 samples)

| Model | Accuracy | F1-macro | F1-weighted |
|---|---|---|---|
| Logistic Regression | 1.000 | 1.000 | 1.000 |
| Naive Bayes | 1.000 | 1.000 | 1.000 |
| Linear SVM | 1.000 | 1.000 | 1.000 |

All three reach a perfect score on the test split, with every class at precision = recall = 1.000 (`model_comparison.png`, `confusion_matrix.png` — a clean diagonal).

### 7.2 5-fold stratified cross-validation (F1-macro)

Cross-validation is the more honest estimate because it averages over five different splits:

| Model | Mean F1-macro | Std |
|---|---|---|
| Logistic Regression | 0.990 | ±0.014 |
| Naive Bayes | **0.993** | ±0.008 |
| Linear SVM | 0.990 | ±0.014 |

Saved as `cross_validation.png`. All three are statistically indistinguishable; the ~1% error comes almost entirely from the harder real emails and the rare classes.

### 7.3 Performance improvement — tuning and ensembling

Two improvement steps were applied to the best model (`performance_improvement.png`):

- **Hyperparameter tuning:** a 5-fold `GridSearchCV` over the TF-IDF (`ngram_range`, `max_features`) and the classifier's regularisation. Best configuration: `C=0.5, max_features=3000, ngram_range=(1,1)` at CV F1-macro **0.991** — i.e. a *simpler* model (unigrams, fewer features, stronger regularisation) generalises just as well, which is the right lesson on a small dataset.
- **Ensemble:** a hard-voting `VotingClassifier` over all three models. Test F1-macro **1.000**.

| Configuration | Accuracy | F1-macro |
|---|---|---|
| Logistic Regression (baseline) | 1.000 | 1.000 |
| Logistic Regression (tuned) | 1.000 | 1.000 |
| Voting ensemble | 1.000 | 1.000 |

### 7.4 Feature importance

`feature_importance.png` shows the top TF-IDF features per class. They are human-sensible (e.g. `fee`: *voucher, installment, late*; `wellbeing`: *stressed, help, alone*; `security`: *password, verify, click*), which confirms the models learned real vocabulary, not artefacts.

---

## 8. Classifier vs. LLM Agent

The project also contains an LLM-based agent (Gemini via LangGraph) that does far more than classify. The notebook compares them qualitatively (`capability_comparison.png`):

| Dimension | Classical classifier | LLM agent |
|---|---|---|
| Task coverage | Category (and priority) only | Category + priority + escalation + policy lookup + reply drafting |
| Training data | Needs a labelled dataset | Zero-shot from instructions |
| Speed / cost | Milliseconds, free, offline | ~seconds per email, API cost, network |
| Explainability | Transparent coefficients | Natural-language reasoning + step log |
| New category | Needs retraining | Add a line to the prompt |
| Best role | Fast, cheap, auditable first-pass router | Full triage, reply drafting, safety |

**Takeaway:** they are complements. A classifier is the ideal cheap, deterministic **front-line router**; the LLM agent handles the judgement-heavy work (escalation, policy-grounded replies, safety net) the classifier cannot.

---

## 9. Challenges and Limitations

- **Perfect scores are a warning, not a trophy.** 100% test accuracy means the task is *too easy for this data*: the 400 synthetic emails are template-generated, so each class has a near-deterministic vocabulary that a linear model separates trivially. The honest signal is the cross-validation (~0.99) and, more so, the behaviour on the 20 real emails, which carry the noise synthetic data lacks. The models are validated here; real-world accuracy would be lower and would need a larger corpus of genuine emails to measure.
- **Synthetic-data bias.** Templates encode the author's assumptions about how each category "reads". A real inbox has ambiguous and multi-issue emails the generator under-represents.
- **Small real set.** With only 20 real emails, the real-vs-synthetic gap cannot be measured per class.
- **No deep semantics.** TF-IDF is bag-of-words: it misses word order and meaning (e.g. sarcasm, negation). It works here because vocabulary alone is decisive; it would struggle on subtler text.
- **Roman Urdu.** Mixed-language tokens are treated as plain terms; this is fine for frequency features but a dedicated tokenizer/transliteration step would help on a larger Roman-Urdu set.

**How to strengthen it:** collect more real, hand-labelled emails; add harder/ambiguous synthetic cases; hold out *by source* (train on synthetic, test on real) to measure the true generalisation gap.

---

## 10. Conclusion

We framed student-email routing as a nine-class text-classification problem, built a 420-row two-source dataset, performed EDA that quantified a moderate class imbalance (IR ≈ 3.6) and confirmed short, vocabulary-separable text, and trained three classical classifiers. All three reached ~0.99 cross-validated F1-macro; tuning showed a simpler model generalises equally, and a voting ensemble matched the best single model. We addressed imbalance with balanced class weights, F1-macro, and stratified evaluation, and we were candid that the perfect test scores reflect easy synthetic data rather than a solved real-world problem. Finally, we positioned the classifier against the LLM agent: a fast, auditable router alongside a judgement-capable assistant. The work satisfies CLO 3 — selecting and applying appropriate AI techniques to a classification problem of moderate complexity — and interprets the results honestly.

**Reproduce:** `pip install -r analysis/requirements.txt` then run all cells of `analysis/eda.ipynb`; all 11 charts are written to `analysis/plots/`.
