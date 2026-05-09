def suma(a, b):
    return a + b

def resta(a, b):
    return a - b

def multiplicacion(a, b):
    return a * b

def division(a, b):
    if b == 0:
        return "Error: División por cero"
    return a / b

def calculadora():
    print("--- CALCULADORA SENCILLA ---")
    print("1. Suma")
    print("2. Resta")
    print("3. Multiplicación")
    print("4. División")
    
    opcion = input("Elige una opción (1/2/3/4): ")
    
    if opcion in ['1', '2', '3', '4']:
        num1 = float(input("Primer número: "))
        num2 = float(input("Segundo número: "))
        
        if opcion == '1':
            print(f"Resultado: {num1} + {num2} = {suma(num1, num2)}")
        elif opcion == '2':
            print(f"Resultado: {num1} - {num2} = {resta(num1, num2)}")
        elif opcion == '3':
            print(f"Resultado: {num1} * {num2} = {multiplicacion(num1, num2)}")
        elif opcion == '4':
            print(f"Resultado: {num1} / {num2} = {division(num1, num2)}")
    else:
        print("Opción no válida")

if __name__ == "__main__":
    calculadora()
