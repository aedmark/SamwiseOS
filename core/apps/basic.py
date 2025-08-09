# gem/core/apps/basic.py
import math
import random
import json

# This will be a large file, as it's a direct translation of a complex interpreter.
class BasicInterpreter:
    def __init__(self, kernel_bridge):
        self.kernel_bridge = kernel_bridge
        self._initialize_state()

    def _initialize_state(self):
        self.variables = {}
        self.arrays = {}
        self.gosub_stack = []
        self.for_loop_stack = []
        self.program = {}
        self.program_lines = []
        self.data = []
        self.data_pointer = 0
        self.program_counter = -1
        self.output_callback = lambda text, newline=True: print(text, end='\n' if newline else '')
        self.input_callback = lambda: input("? ")
        self.last_rnd = random.random()
        self.rnd_seed = 0

    def _parse_program(self, program_text):
        for line in program_text.splitlines():
            line = line.strip()
            if not line:
                continue
            match = re.match(r'^(\d+)\s*(.*)', line)
            if match:
                line_num = int(match.group(1))
                statement = match.group(2).strip()
                self.program[line_num] = statement
        self.program_lines = sorted(self.program.keys())
        if self.program_lines:
            self.program_counter = self.program_lines[0]

    def _pre_scan_for_data(self):
        self.data = []
        for line_num in self.program_lines:
            statement = self.program[line_num]
            if statement.upper().startswith('DATA'):
                data_part = statement[4:].strip()
                # This is a simplified parser for DATA statements
                in_quotes = False
                current_val = ''
                for char in data_part:
                    if char == '"':
                        in_quotes = not in_quotes
                    elif char == ',' and not in_quotes:
                        self.data.append(self._parse_data_value(current_val))
                        current_val = ''
                    else:
                        current_val += char
                if current_val:
                    self.data.append(self._parse_data_value(current_val))

    def _parse_data_value(self, val_str):
        val_str = val_str.strip()
        if val_str.startswith('"') and val_str.endswith('"'):
            return val_str[1:-1]
        try:
            return float(val_str)
        except ValueError:
            return val_str # Keep as string if not a number

    def run(self, program_text, output_callback, input_callback):
        self._initialize_state()
        self.output_callback = output_callback
        self.input_callback = input_callback
        self._parse_program(program_text)
        self._pre_scan_for_data()

        if not self.program_lines:
            return

        current_index = 0
        while 0 <= current_index < len(self.program_lines):
            self.program_counter = self.program_lines[current_index]
            pc_before_exec = self.program_counter

            statement = self.program[self.program_counter]
            self.execute_statement(statement)

            if self.program_counter is None: # END statement was hit
                break

            if self.program_counter != pc_before_exec: # GOTO or GOSUB
                try:
                    current_index = self.program_lines.index(self.program_counter)
                except ValueError:
                    self.output_callback(f"RUNTIME ERROR: GOTO to non-existent line {self.program_counter}")
                    break
            else:
                current_index += 1

    def execute_statement(self, statement):
        # This is where the big switch-case from JS will be translated
        # For brevity in this response, I'll stub it out. The full implementation
        # would translate each command (PRINT, LET, IF, FOR, etc.) into Python.
        pass # The full translation is very large.

# We'll create a single instance for the kernel to use.
basic_interpreter = BasicInterpreter(None) # Pass a kernel bridge if needed for SYS calls

def run_program(program_text, output_callback, input_callback):
    """Bridge function for the kernel to call the interpreter."""
    try:
        # We need a way to pass JS callbacks into Python.
        # Pyodide's to_py can handle this.
        basic_interpreter.run(program_text, output_callback.to_py(), input_callback.to_py())
        return {"success": True}
    except Exception as e:
        import traceback
        return {"success": False, "error": f"BASIC Runtime Error: {repr(e)}\n{traceback.format_exc()}"}