from filesystem import fs_manager
from datetime import datetime

def format_mode_to_string(node):
    if 'mode' not in node or not isinstance(node['mode'], int):
        return "----------"
    type_char = 'd' if node.get('type') == 'directory' else '-'
    mode = node['mode']
    perms = []
    for i in range(3):
        p = (mode >> (6 - i * 3)) & 7
        perms.append("r" if p & 4 else "-")
        perms.append("w" if p & 2 else "-")
        perms.append("x" if p & 1 else "-")
    return type_char + "".join(perms)

def run(args, flags, user_context):
    path_arg = args[0] if args else "."
    full_path = fs_manager.get_absolute_path(path_arg)
    node = fs_manager.get_node(full_path)

    if not node:
        raise FileNotFoundError(f"ls: cannot access '{path_arg}': No such file or directory")

    if node.get('type') != 'directory':
        return path_arg

    output_lines = []
    children = node.get('children', {})
    sorted_names = sorted(children.keys())

    for name in sorted_names:
        child_node = children[name]
        if not "-a" in flags and name.startswith('.'):
            continue

        if "-l" in flags:
            perms = format_mode_to_string(child_node)
            owner = child_node.get('owner', 'unknown').ljust(10)
            group = child_node.get('group', 'unknown').ljust(10)
            size = str(len(child_node.get('content', ''))).rjust(8)
            try:
                mtime_str = child_node.get('mtime', '').split('.')[0]
                mtime_obj = datetime.fromisoformat(mtime_str)
                mtime = mtime_obj.strftime('%b %d %H:%M')
            except:
                mtime = "Jan 01 1970"
            output_lines.append(f"{perms}  1 {owner}{group}{size} {mtime.ljust(12)} {name}")
        else:
            output_lines.append(name)

    return "\\n".join(output_lines)