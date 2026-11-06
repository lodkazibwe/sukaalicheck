import logging
from pathlib import Path

import joblib

logger = logging.getLogger(__name__)

_ML_DIR = Path(__file__).parent.parent / "ml"

# Stored on every prediction record so results stay traceable to the model that produced them.
# Records created before this model was introduced are backfilled as "v1".
MODEL_VERSION = "v2"

_model = None
_feature_columns: list[str] = []


def init_model() -> None:
    global _model, _feature_columns
    model = joblib.load(_ML_DIR / "SukaaliCheckV2.pkl")
    feature_columns = list(joblib.load(_ML_DIR / "feature_columnsSC.pkl"))

    # Feature order is positional at predict time — refuse to start on a mismatched pair.
    if list(model.feature_names_in_) != feature_columns:
        raise RuntimeError(
            f"Model features {list(model.feature_names_in_)} do not match "
            f"feature_columnsSC.pkl {feature_columns}"
        )

    _model = model
    _feature_columns = feature_columns
    logger.info(
        "ML model %s loaded. classes_=%s features=%s",
        MODEL_VERSION,
        _model.classes_,
        _feature_columns,
    )


def get_model():
    return _model


def get_feature_columns() -> list[str]:
    return _feature_columns
