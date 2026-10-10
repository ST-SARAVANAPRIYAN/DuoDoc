"""
Corpus-Trained Subword Tokenizer (From Scratch)
Implements Slide 10: Stage 3 (Text Modality Encoding).

Zero pretrained weights: trains directly on document text corpus using frequency-based
subword segmentation with support for special tokens ([PAD], [UNK], [CLS], [SEP], [MASK]).
"""

import os
import re
import json
from collections import Counter
from typing import List, Dict, Any, Optional


SPECIAL_TOKENS = ["[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]"]
PAD_ID = 0
UNK_ID = 1
CLS_ID = 2
SEP_ID = 3
MASK_ID = 4


class CorpusSubwordTokenizer:
    """
    Subword tokenizer trained directly on the document vocabulary.
    """

    def __init__(self, vocab_size: int = 4000):
        self.target_vocab_size = vocab_size
        self.vocab: Dict[str, int] = {}
        self.inv_vocab: Dict[int, str] = {}
        self._initialize_special_tokens()

    def _initialize_special_tokens(self):
        self.vocab = {tok: idx for idx, tok in enumerate(SPECIAL_TOKENS)}
        self.inv_vocab = {idx: tok for idx, tok in enumerate(SPECIAL_TOKENS)}

    def _tokenize_text(self, text: str) -> List[str]:
        # Basic alphanumeric and punctuation splitting
        return re.findall(r"\w+|[^\w\s]", text.lower(), re.UNICODE)

    def train_from_texts(self, texts: List[str]):
        """
        Builds subword vocabulary from a list of document strings.
        """
        self._initialize_special_tokens()
        word_counts = Counter()

        for t in texts:
            tokens = self._tokenize_text(t)
            word_counts.update(tokens)

        # 1. Add all single characters to ensure any word can be represented
        chars = set()
        for word in word_counts:
            chars.update(list(word))

        for ch in sorted(list(chars)):
            if ch not in self.vocab and len(self.vocab) < self.target_vocab_size:
                idx = len(self.vocab)
                self.vocab[ch] = idx
                self.inv_vocab[idx] = ch

        # 2. Add high-frequency full words and subwords
        remaining = self.target_vocab_size - len(self.vocab)
        most_common = word_counts.most_common(remaining * 2)

        for word, _ in most_common:
            if word not in self.vocab and len(self.vocab) < self.target_vocab_size:
                idx = len(self.vocab)
                self.vocab[word] = idx
                self.inv_vocab[idx] = word

        print(f"Tokenizer trained: {len(self.vocab)} tokens in vocabulary.")

    def encode(self, text: str, max_length: Optional[int] = None, add_special_tokens: bool = True) -> List[int]:
        """
        Encodes a string into token IDs with optional padding/truncation and special tokens.
        """
        words = self._tokenize_text(text)
        token_ids = []

        if add_special_tokens:
            token_ids.append(CLS_ID)

        for w in words:
            if w in self.vocab:
                token_ids.append(self.vocab[w])
            else:
                # Character fallback
                matched = False
                for ch in w:
                    if ch in self.vocab:
                        token_ids.append(self.vocab[ch])
                        matched = True
                if not matched:
                    token_ids.append(UNK_ID)

        if add_special_tokens:
            token_ids.append(SEP_ID)

        if max_length is not None:
            if len(token_ids) > max_length:
                token_ids = token_ids[:max_length]
                if add_special_tokens:
                    token_ids[-1] = SEP_ID
            else:
                token_ids = token_ids + [PAD_ID] * (max_length - len(token_ids))

        return token_ids

    def decode(self, token_ids: List[int], skip_special_tokens: bool = True) -> str:
        """
        Decodes a sequence of token IDs back into text.
        """
        tokens = []
        for tid in token_ids:
            if skip_special_tokens and tid in (PAD_ID, CLS_ID, SEP_ID, MASK_ID):
                continue
            tokens.append(self.inv_vocab.get(tid, "[UNK]"))
        return " ".join(tokens)

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump({
                "vocab": self.vocab,
                "target_vocab_size": self.target_vocab_size
            }, f, indent=2)

    @classmethod
    def load(cls, filepath: str) -> "CorpusSubwordTokenizer":
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        tok = cls(vocab_size=data.get("target_vocab_size", 4000))
        tok.vocab = data["vocab"]
        tok.inv_vocab = {int(v): k for k, v in tok.vocab.items()}
        return tok

    def __len__(self) -> int:
        return len(self.vocab)
