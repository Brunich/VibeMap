import random

def juego_ppt():
    opciones = ["piedra", "papel", "tijera"]
    print("--- PIEDRA, PAPEL O TIJERA ---")
    
    while True:
        usuario = input("Elige (piedra/papel/tijera) o 'salir': ").lower()
        if usuario == 'salir':
            break
        
        if usuario not in opciones:
            print("Opción no válida.")
            continue
            
        maquina = random.choice(opciones)
        print(f"La máquina eligió: {maquina}")
        
        if usuario == maquina:
            print("¡Empate!")
        elif (usuario == "piedra" and maquina == "tijera") or \
             (usuario == "papel" and maquina == "piedra") or \
             (usuario == "tijera" and maquina == "papel"):
            print("¡Ganaste!")
        else:
            print("Perdiste...")
        print("-" * 20)

if __name__ == "__main__":
    juego_ppt()
