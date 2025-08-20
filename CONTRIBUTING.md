# Contributing to SamwiseOS

Welcome! We're thrilled you're interested in contributing to SamwiseOS. This document provides the guidelines for contributing to the project, ensuring that our command library remains consistent, predictable, and easy for everyone to use and maintain.

## How to Add a New Command

1.  **Create the File:** Add a new Python file in the `gemini/core/commands/` directory. The filename should be the name of your command (e.g., `newcmd.py`).
2.  **Implement the Core Functions:** Your new command file must include three standard functions: `run`, `man`, and `help`. It can also optionally include `define_flags`.
3.  **Adhere to Standards:** Follow the standards outlined below for documentation, error handling, and help text.
4.  **Use a Reference:** When in doubt, refer to `gemini/core/commands/grep.py` as the "golden standard" or pilot episode for command structure.

## Command Development Standards

### 1. `man` Page Template

The `man` function provides detailed documentation for your command. It must follow this structure precisely.

```python
def man(args, flags, user_context, **kwargs):
    return \"\"\"
NAME
    command - A brief, one-line summary of the command.

SYNOPSIS
    command [OPTIONS] <required_argument> [optional_argument]

DESCRIPTION
    A full paragraph explaining what the command does, its purpose, and any important details about its behavior.

OPTIONS
    -s, --long
          A clear and concise explanation of what this flag does.
    -o, --other-flag
          Explanation for another flag.

EXAMPLES
    command -s /path/to/file
        Explain what this specific example does.
    command --long "some value"
        Explain this different use case.
\"\"\"
````

### 2. `help` Function Format

The `help` function provides a quick usage summary. It must return a **single string** in the following format:

Python

```
def help(args, flags, user_context, **kwargs):
    return "Usage: command [OPTIONS] <required_argument> [optional_argument]..."
```

### 3. Standardized Error Handling

All commands that can fail must return a specific dictionary structure. This ensures that the frontend can parse and display errors consistently and helpfully.

- **Structure:**

  Python

    ```
    return {
        "success": False,
        "error": {
            "message": "command: A description of what went wrong.",
            "suggestion": "A helpful tip on how to fix it."
        }
    }
    ```

- **Implementation:** Review every possible failure point in your `run` function. Instead of returning a simple string error, return this dictionary. This provides a much better user experience.


By following these guidelines, we can ensure that every part of SamwiseOS, from the core commands to community contributions, feels like part of a cohesive and well-planned series. Thank you for helping us build something great!