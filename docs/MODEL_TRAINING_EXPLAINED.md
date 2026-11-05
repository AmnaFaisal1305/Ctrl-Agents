# How the Model Is Trained — Step by Step

A plain-English walkthrough of `analysis/eda.ipynb`: what happens to an email on its way to becoming a prediction, every parameter we chose, and why. Read this alongside the notebook — each section names the cell it explains.

---

## The big picture in one sentence

We turn each email's words into numbers (**TF-IDF**), show a classifier thousands of (numbers → category) examples so it learns which words point to which category (**training**), then test it on emails it never saw (**evaluation**).

```
email text ──clean──► "clean_text" ──TF-IDF──► number vector ──classifier──► category
                                                                   ▲
                                                        learned from training examples
```

Nothing here is deep learning. These are **classical machine-learning** text classifiers — the right tool for a few hundred short emails.

---

## Step 1 — Get the data (notebook cells 6–10)

We load two datasets and stack them into one table of **420 rows**:

- **20 real emails** — from `data/inbox/E*.json`, labelled with the category the agent assigned in `outbox.json`.
- **400 synthetic emails** — made by `analysis/generate_data.py`, covering all 9 categories.

For every email we build one text field:

```python
df['text'] = df['subject'] + ' ' + df['body']
```

That `text` is the **only input** the model ever sees. The **label** it must predict is `category` (one of 9: `fee, hostel, academic, technical, wellbeing, harassment, legal_media, security, other`).

> **Term:** *feature* = the input (the email text). *Label / target* = the answer we want (the category). *Supervised learning* = learning from examples where we already know the answer.

---

## Step 2 — Clean the text (cell 25)

Raw text is messy ("Fee!!!", "FEE", "fee" should all count as the same word). We normalise it into `clean_text`:

```python
def clean_text(text):
    text = text.lower()                       # "Fee" and "fee" become the same
    text = text.translate(_PUNCT_TABLE)       # remove . , ! ? etc.
    tokens = [t for t in text.split() if len(t) > 1]   # drop 1-letter noise
    return ' '.join(tokens)
```

So `"Late FEE!! waiver??"` → `"late fee waiver"`. No row is ever dropped — a missing subject or body just becomes an empty string, so **every** email still produces a prediction.

---

## Step 3 — Turn words into numbers: TF-IDF (inside the pipeline, cell 28)

A model can't do maths on words, so we convert each email into a vector of numbers with **TF-IDF** (`TfidfVectorizer`).

**What TF-IDF means, plainly:**
- **TF (Term Frequency):** how often a word appears in *this* email. More mentions of "voucher" → that email leans "fee".
- **IDF (Inverse Document Frequency):** how *rare* the word is across *all* emails. Common words like "the", "please" appear everywhere, so they get a low weight. Distinctive words like "voucher", "harassment", "wifi" get a high weight.
- **TF × IDF:** a word scores high only when it's frequent *here* **and** rare overall — i.e. genuinely informative about the category.

The result: each email becomes a long row of numbers, one slot per word, mostly zeros (a "sparse vector").

**Our settings and why:**

```python
TfidfVectorizer(max_features=5000, ngram_range=(1, 2), sublinear_tf=True)
```

| Setting | Meaning | Why |
|---|---|---|
| `max_features=5000` | keep the 5000 most useful words | caps vector size; ignores ultra-rare noise |
| `ngram_range=(1, 2)` | count single words *and* word pairs | "late fee", "self harm" carry meaning a single word misses |
| `sublinear_tf=True` | use `1 + log(count)` instead of raw count | one email saying "fee" 10× shouldn't dominate one saying it 3× (Naive Bayes keeps this off, because it expects raw counts) |

> **Key point on leakage:** the vectoriser is **inside** each model's `Pipeline`, so it learns its vocabulary from the *training* emails only. The test emails are transformed with that same vocabulary but never influence it. If we vectorised the whole dataset first, the model would "peek" at the test set and our scores would be dishonest.

---

## Step 4 — Split into train and test (cell 27)

We hold back 20% of the emails so we can test on data the model has never seen:

```python
X_train, X_test, y_train, y_test = train_test_split(
    X, y_cat, test_size=0.20, random_state=42, stratify=y_cat)
```

- **336 emails for training**, **84 for testing** (20% of 420).
- `stratify=y_cat` → each category keeps the same proportion in both halves, so small classes like `security` aren't accidentally missing from the test set.
- `random_state=42` → the split is the same every run, so results are reproducible.

The model learns from `X_train`/`y_train` and is judged on `X_test`/`y_test`.

---

## Step 5 — The three models (cell 28)

Each model is a **Pipeline** = TF-IDF step + classifier step glued together, so "fit" and "predict" run both stages in order.

```python
MODELS = {
  'Logistic Regression': Pipeline([('tfidf', TfidfVectorizer(...)),
                                   ('clf', LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42))]),
  'Naive Bayes':         Pipeline([('tfidf', TfidfVectorizer(..., sublinear_tf=False)),
                                   ('clf', MultinomialNB(alpha=0.1))]),
  'Linear SVM':          Pipeline([('tfidf', TfidfVectorizer(...)),
                                   ('clf', LinearSVC(max_iter=2000, class_weight='balanced', random_state=42))]),
}
```

**What each classifier does, in plain terms:**

- **Logistic Regression** — learns a weight for every word, per category. To predict, it adds up the weights of the words present and picks the category with the highest total (turned into a probability). Simple, fast, and its weights are *readable* (that's the feature-importance chart). Strong default for text.
- **Multinomial Naive Bayes** — thinks in terms of "how likely is each word given each category?", then multiplies those likelihoods (assuming words are independent — a naive but effective shortcut). Classic text baseline; very fast. `alpha=0.1` is *smoothing* so a word never seen in a category doesn't force the probability to zero.
- **Linear SVM** (`LinearSVC`) — draws the widest possible boundary between categories in the 5000-dimensional word space. Usually a top performer on sparse TF-IDF text.

**Handling class imbalance:** some categories have ~76 emails, others ~21 (ratio ≈ 3.6). `class_weight='balanced'` tells LogReg and SVM to pay *more* attention to the rarer categories so they aren't ignored. (Naive Bayes has no such knob; its `alpha` smoothing plays a similar protective role.)

### How "training" actually happens

```python
pipeline.fit(X_train, y_train)      # <-- this line IS the training
y_pred = pipeline.predict(X_test)   # <-- predict on unseen emails
```

`.fit()` does two things in order: (1) the TF-IDF step learns the vocabulary and IDF weights from the 336 training emails; (2) the classifier adjusts its internal numbers until its predictions on those 336 emails best match the true categories. After that, `.predict()` runs any new email through the *same* steps and returns a category. That's the whole of training — one line per model.

---

## Step 6 — Measure how good it is

### 6a. On the test set (cells 28–33)

We compare each model's predictions on the 84 unseen emails to the true answers:

| Model | Accuracy | F1-macro | F1-weighted |
|---|---|---|---|
| Logistic Regression | 1.000 | 1.000 | 1.000 |
| Naive Bayes | 1.000 | 1.000 | 1.000 |
| Linear SVM | 1.000 | 1.000 | 1.000 |

- **Accuracy** = fraction predicted correctly.
- **F1-macro** = F1 averaged equally across all 9 categories — our main metric, because it refuses to let big categories hide poor performance on small ones. (F1 itself balances *precision* = "when it says fee, is it right?" and *recall* = "did it catch all the fee emails?".)
- The **confusion matrix** (`confusion_matrix.png`) shows which categories get mixed up — here it's a clean diagonal (no confusion).

### 6b. Cross-validation — the honest number (cell 35)

A single test split can be lucky. **5-fold stratified cross-validation** splits the data into 5 parts, trains on 4 and tests on the 5th, five times, and averages:

| Model | Mean F1-macro | Std |
|---|---|---|
| Logistic Regression | 0.990 | ±0.014 |
| Naive Bayes | 0.993 | ±0.008 |
| Linear SVM | 0.990 | ±0.014 |

This ~0.99 is the number to trust more than the perfect test score. All three are effectively tied.

### Why the scores are near-perfect (important, honest)

100% test accuracy is **not** a trophy — it's a sign the task is *too easy for this data*. The 400 synthetic emails are built from templates, so each category has an almost give-away vocabulary that any of these models separates trivially. On genuinely messy real emails the number would be lower. We say this openly in `docs/TECHNICAL_REPORT.md` §9. The feature-importance chart (`feature_importance.png`) confirms the models at least learned *sensible* words (fee → "voucher, installment"; security → "password, verify, click"), not artefacts.

---

## Step 7 — Improve: tuning + ensemble (cell 40, the §6.5 we added)

The rubric asks for a performance-improvement step. Two were done on the best model (Logistic Regression):

**1. Hyperparameter tuning (`GridSearchCV`)** — automatically tries many settings and keeps the best by cross-validation:

```python
param_grid = {'tfidf__ngram_range': [(1,1),(1,2)],
              'tfidf__max_features': [3000,5000,8000],
              'clf__C': [0.5,1.0,2.0,4.0]}      # C = regularisation strength
grid = GridSearchCV(base, param_grid, scoring='f1_macro', cv=5)
grid.fit(X_train, y_train)
```

Best combination found: `C=0.5, max_features=3000, ngram_range=(1,1)` at CV F1-macro **0.991**. The lesson: a *simpler* model (single words, fewer features, stronger regularisation) generalises just as well here — exactly what you want on a small dataset, because it's less likely to overfit.

> **`C`** controls how hard the model tries to fit the training data. High `C` = fit hard (risk overfitting); low `C` = stay simple. The grid chose a low `C`, i.e. "keep it simple".

**2. Ensemble (`VotingClassifier`)** — run all three models and let them vote on each email:

```python
ensemble = VotingClassifier(estimators=[...three pipelines...], voting='hard')
```

`voting='hard'` = majority vote of the predicted labels. Test F1-macro **1.000**. Ensembles usually beat any single model by averaging out individual mistakes; here everything's already near-perfect, so it matches rather than exceeds.

---

## Step 8 — Classifier vs. the LLM agent (cells 42–43)

The notebook ends by comparing this trained classifier against the project's LLM agent (`capability_comparison.png`). Short version: the classifier is a **fast, free, offline, auditable router** that only predicts a category; the LLM agent does the full job (category + priority + escalation + policy-grounded reply + safety). They're complements, not competitors.

---

## Glossary

| Term | Plain meaning |
|---|---|
| Feature | the input — here, the email text |
| Label / target | the answer to predict — the category |
| TF-IDF | scoring words by how frequent-here and rare-overall they are |
| n-gram | a single word (unigram) or word pair (bigram) |
| Pipeline | vectoriser + classifier chained so they run together |
| `.fit()` | the training step — model learns from examples |
| `.predict()` | use the trained model on new emails |
| Stratified split | keep each category's proportion when splitting |
| Accuracy | fraction correct |
| Precision / Recall | "when it says X, is it right?" / "did it catch all the X?" |
| F1-macro | F1 averaged equally over all categories (our main metric) |
| Cross-validation | train/test on several rotating splits and average |
| `class_weight='balanced'` | pay more attention to rarer categories |
| Hyperparameter tuning | auto-search for the best settings |
| Ensemble | combine several models by voting |
| Overfitting | memorising the training data instead of learning the pattern |

---

**Reproduce everything:** `pip install -r analysis/requirements.txt`, then open `analysis/eda.ipynb` and *Restart & Run All*. All 11 charts land in `analysis/plots/`.
