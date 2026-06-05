import logging
from pathlib import Path

import joblib

logger = logging.getLogger(__name__)

_ML_DIR = Path(__file__).parent.parent / "ml"

_model = None


def init_model() -> None:
    global _model
    _model = joblib.load(_ML_DIR / "OptimizedRFmodel.pkl")
    logger.info(
        "ML model loaded. classes_=%s features=%s",
        _model.classes_,
        list(_model.feature_names_in_),
    )


def get_model():
    return _model
