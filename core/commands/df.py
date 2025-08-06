# gem/core/commands/df.py

from filesystem import fs_manager

def _format_bytes(byte_count):
    if byte_count is None:
        return "0B"
    power = 1024
    n = 0
    power_labels = {0: '', 1: 'K', 2: 'M', 3: 'G', 4: 'T'}
    while byte_count >= power and n < len(power_labels) -1 :
        byte_count /= power
        n += 1
    return f"{byte_count:.1f}{power_labels[n]}"

def run(args, flags, user_context, stdin_data=None, users=None, user_groups=None, config=None):
    if config is None:
        return "df: Configuration data not available."

    total_size = config.get('MAX_VFS_SIZE', 0)
    used_size = fs_manager.calculate_node_size('/')
    available_size = total_size - used_size
    use_percentage = int((used_size / total_size) * 100) if total_size > 0 else 0

    is_human_readable = "-h" in flags or "--human-readable" in flags

    if is_human_readable:
        total_str = _format_bytes(total_size).rjust(8)
        used_str = _format_bytes(used_size).rjust(8)
        avail_str = _format_bytes(available_size).rjust(8)
    else:
        total_str = str(total_size).rjust(8)
        used_str = str(used_size).rjust(8)
        avail_str = str(available_size).rjust(8)

    header = "Filesystem      Size      Used     Avail   Use%  Mounted on"
    separator = "----------  --------  --------  --------  ----  ----------"
    data = (f"{'OopisVFS'.ljust(10)}  {total_str}  {used_str}  {avail_str}  "
            f"{str(use_percentage).rjust(3)}%  {'/'}")

    return f"{header}\n{separator}\n{data}"

def man(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return """
NAME
    df - report file system disk space usage

SYNOPSIS
    df [OPTION]...

DESCRIPTION
    Show information about the file system.

    -h, --human-readable
          print sizes in powers of 1024 (e.g., 1023M)
"""

def help(args, flags, user_context, stdin_data=None, users=None, user_groups=None):
    return "Usage: df [-h]"