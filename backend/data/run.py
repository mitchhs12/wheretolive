import os
import subprocess
import sys

def main():
    """
    Finds and executes all Python scripts in subdirectories of its own location.
    """
    # Get the absolute path of the directory where this script is located.
    # This will be your 'data' folder.
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    print(f"Master script started. Searching for scripts in subfolders of: {root_dir}")
    print("-" * 50)

    # os.walk() is perfect for this. It goes through a directory tree top-down.
    # dirpath: the current folder it's looking at.
    # dirnames: a list of subfolders in the current folder.
    # filenames: a list of files in the current folder.
    for dirpath, dirnames, filenames in os.walk(root_dir):
        for filename in filenames:
            # We construct the full path to the file
            full_path = os.path.join(dirpath, filename)

            # Check if the file is a Python script and IS NOT this script itself.
            if filename.endswith('.py') and full_path != os.path.abspath(__file__):
                
                print(f"\n>>> Found Python script: {filename}")
                print(f">>> Location: {dirpath}")
                print(">>> Executing...")

                try:
                    # Use the 'subprocess' module to run the script in a new process.
                    # This is the modern and recommended way to run external commands.
                    # 'sys.executable' ensures we run the child script with the same
                    # Python interpreter that is running this master script.
                    result = subprocess.run(
                        [sys.executable, full_path],
                        capture_output=True,  # Capture the stdout and stderr
                        text=True,            # Decode output as text
                        check=True,           # Raise an exception if the script returns a non-zero exit code (an error)
                        cwd=dirpath           # CRITICAL: Set the working directory to the script's folder
                    )

                    # Print the output from the executed script
                    print("--- Script Output ---")
                    print(result.stdout)
                    print("--- End of Output ---")
                    print(f">>> Finished: {filename}\n")

                except subprocess.CalledProcessError as e:
                    # This block runs if the script fails (returns a non-zero exit code)
                    print("--- SCRIPT FAILED ---")
                    print(f"Error while running: {filename}")
                    print(f"Return Code: {e.returncode}")
                    print("--- Error Output (stderr) ---")
                    print(e.stderr)
                    print("--- Standard Output (stdout) ---")
                    print(e.stdout)
                    print("--- End of Failure Report ---\n")
                except Exception as e:
                    # Handle other potential errors like file not found, etc.
                    print(f"An unexpected error occurred trying to run {filename}: {e}\n")

    print("-" * 50)
    print("All scripts have been executed.")

if __name__ == "__main__":
    main()