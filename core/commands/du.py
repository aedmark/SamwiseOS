# gem/core/commands/du.py

from filesystem import fs_manager

def _format_bytes(byte_count):
    if byte_count is None:
        return "0B"
    if byte_count == 0:
        return "0B"
    power = 1024
    n = 0
    power_labels = {0: 'B', 1: 'K', 2: 'M', 3: 'G', 4: 'T'}
    while byte_count >= power and n < len(power_labels) -1 :
        byte_count /= power
        n += 1
    # Use integer if it's a whole number, otherwise one decimal place
    if byte_count == int(byte_count):
        return f"{int(byte_count)}{power_labels[n]}"
    return f"{byte_count:.1f}{power_labels[n]}"

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    paths = args if args else ['.']
    is_summarize = "-s" in flags or "--summarize" in flags
    is_human_readable = "-h" in flags or "--human-readable" in flags
    output_lines = []
    had_error = False

    for path in paths:
        node = fs_manager.get_node(path)
        if not node:
            output_lines.append(f"du: cannot access '{path}': No such file or directory")
            had_error = True
            continue

        if is_summarize:
            total_size = fs_manager.calculate_node_size(path)
            size_str = _format_bytes(total_size) if is_human_readable else str(total_size)
            output_lines.append(f"{size_str}\t{path}")
        else:
            sizes = []
            def recurse_du(current_path, current_node):
                if current_node.get('type') == 'directory':
                    for child_name, child_node in current_node.get('children', {}).items():
                        child_path = fs_manager.get_absolute_path(f"{current_path}/{child_name}")
                        recurse_du(child_path, child_node)

                size = fs_manager.calculate_node_size(current_path)
                sizes.append((size, current_path))

            recurse_du(path, node)
            for size, p in sorted(sizes, key=lambda x: x[1]):
                size_str = _format_bytes(size) if is_human_readable else str(size)
                output_lines.append(f"{size_str}\t{p}")

    if had_error:
        # If there were any errors, we still print what we could process, similar to coreutils du
        pass

    return "\n".join(output_lines)

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return """
NAME
    du - estimate file space usage

SYNOPSIS
    du [OPTION]... [FILE]...

DESCRIPTION
    Summarize disk usage of the set of FILEs, recursively for directories.

    -h, --human-readable
          print sizes in human readable format (e.g., 1K 234M 2G)
    -s, --summarize
          display only a total for each argument
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None, groups=None):
    return "Usage: du [-h] [-s] [FILE]..."