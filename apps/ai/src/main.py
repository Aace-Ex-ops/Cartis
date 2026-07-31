"""cartis-ai CLI: model training entry point.

Usage:
    cartis-ai train-recommendations    # daily 2am
    cartis-ai train-price-prediction   # weekly Sunday
    cartis-ai export-data              # every 12h
"""
import argparse
import logging
import sys

from . import export_training_data, train_price_prediction, train_recommendations

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

JOBS = {
    "train-recommendations": train_recommendations.train,
    "train-price-prediction": train_price_prediction.train,
    "export-data": export_training_data.export,
}


def main() -> int:
    parser = argparse.ArgumentParser(prog="cartis-ai")
    parser.add_argument("job", choices=JOBS.keys())
    args = parser.parse_args()
    try:
        JOBS[args.job]()
        return 0
    except Exception as e:  # noqa: BLE001
        log.exception("job %s failed: %s", args.job, e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
