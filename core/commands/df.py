# gem/core/commands/df.py

from filesystem import fs_manager

def define_flags():
    """Declares the flags that the df command accepts."""
    return {
        'flags': [
            {'name': 'human-readable', 'short': 'h', 'long': 'human-readable', 'takes_value': False},
        ],
        'metadata': {}
    }

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

def run(args, flags, user_context, config=None, **kwargs):
    if args:
        return {"success": False, "error": "df: command takes no arguments"}
    if config is None:
        return {"success": False, "error": "df: Configuration data not available."}

    total_size = config.get('MAX_VFS_SIZE', 0)
    used_size = fs_manager.calculate_node_size('/')
    available_size = total_size - used_size
    use_percentage = int((used_size / total_size) * 100) if total_size > 0 else 0

    is_human_readable = flags.get('human-readable', False)

    if is_human_readable:
        total_str = _format_bytes(total_size).rjust(8)
        used_str = _format_bytes(used_size).rjust(8)
        avail_str = _format_bytes(available_size).rjust(8)
    else:
        total_str = str(total_size // 1024).rjust(8)
        used_str = str(used_size // 1024).rjust(8)
        avail_str = str(available_size // 1024).rjust(8)

    header = "Filesystem     1K-blocks     Used Available Use% Mounted on"
    if is_human_readable:
        header = "Filesystem      Size      Used     Avail Use% Mounted on"

    data = (f"{'SamwiseVFS'.ljust(10)}  {total_str}  {used_str}  {avail_str}  "
            f"{str(use_percentage).rjust(3)}% /")

    return f"{header}\n{data}"

def man(args, flags, user_context, **kwargs):
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

def help(args, flags, user_context, **kwargs):
    """Provides help information for the df command."""
    return "Usage: df [-h]"