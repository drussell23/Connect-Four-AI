import sys
import argparse
from pathlib import Path
import tensorflow as tf 

# Attempt to import the TF.js converter
try:
    import tensorflowjs as tfjs 
except ImportError:
    sys.stderr.write(
        "Error: `tensorflowjs` package not found.\n"
        "Install it with `pip install tensorflowjs`.\n"
    )
    sys.exit(1)


def export_to_tfjs(input_h5: Path, output_dir: Path) -> None:
    """Load a Keras .h5 model and save it in TensorFlow.js format."""
    if not input_h5.is_file():
        sys.stderr.write(f"Input model not found at: {input_h5}\n")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"🔄 Loading Keras model from {input_h5}")
    model = tf.keras.models.load_model(str(input_h5))

    print(f"🚀 Exporting model to TF.js format in: {output_dir}")
    tfjs.converters.save_keras_model(model, str(output_dir))

    print("✅ Export complete.")


def main():
    base = Path(__file__).resolve().parent.parent / 'models' / 'connect4'
    default_h5 = base / 'keras_model.h5'
    default_tfjs = base / 'tfjs_model'

    parser = argparse.ArgumentParser(
        description="Export a Keras model to TensorFlow.js format"
    )
    parser.add_argument(
        '-i', '--input', type=Path, default=default_h5,
        help="Path to the trained Keras .h5 model file"
    )
    parser.add_argument(
        '-o', '--output', type=Path, default=default_tfjs,
        help="Directory to write the TF.js model files"
    )
    args = parser.parse_args()

    export_to_tfjs(args.input, args.output)


if __name__ == '__main__':
    main()
