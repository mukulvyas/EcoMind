import ast
import sys

def add_docstrings(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        source = f.read()
    
    tree = ast.parse(source)
    lines = source.split('\n')
    
    modifications = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if ast.get_docstring(node) is None:
                # Add docstring after the function definition line
                lineno = node.lineno - 1
                while not lines[lineno].strip().endswith(':'):
                    lineno += 1
                indent = ' ' * (node.col_offset + 4)
                docstring = f'{indent}"""\n{indent}A brief description of {node.name}.\n{indent}Args:\n{indent}    ...\n{indent}Returns:\n{indent}    ...\n{indent}Raises:\n{indent}    ...\n{indent}"""'
                modifications.append((lineno, docstring))
    
    # Apply modifications in reverse order
    modifications.sort(key=lambda x: x[0], reverse=True)
    for lineno, docstring in modifications:
        lines.insert(lineno + 1, docstring)
        
    with open(filename, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

add_docstrings('backend/services/firestore_service.py')
add_docstrings('backend/routers/footprint.py')
add_docstrings('backend/services/gemini_service.py')
add_docstrings('backend/services/govt_service.py')
