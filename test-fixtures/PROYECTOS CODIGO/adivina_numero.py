import random

def juego_adivinanza():
    numero_secreto = random.randint(1, 100)
    intentos = 0
    print("--- ADIVINA EL NÚMERO (1 al 100) ---")
    
    while True:
        intento = int(input("Introduce tu número: "))
        intentos += 1
        
        if intento < numero_secreto:
            print("Más alto...")
        elif intento > numero_secreto:
            print("Más bajo...")
        else:
            print(f"¡Felicidades! Adivinaste en {intentos} intentos.")
            break

if __name__ == "__main__":
    juego_adivinanza()
