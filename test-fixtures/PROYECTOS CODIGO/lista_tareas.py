def mostrar_menu():
    print("\n--- LISTA DE TAREAS ---")
    print("1. Ver tareas")
    print("2. Agregar tarea")
    print("3. Eliminar tarea")
    print("4. Salir")

def gestor_tareas():
    tareas = []
    while True:
        mostrar_menu()
        opcion = input("Elige una opción: ")
        
        if opcion == '1':
            if not tareas:
                print("La lista está vacía.")
            else:
                for i, tarea in enumerate(tareas, 1):
                    print(f"{i}. {tarea}")
        elif opcion == '2':
            nueva_tarea = input("Escribe la tarea: ")
            tareas.append(nueva_tarea)
            print("Tarea agregada.")
        elif opcion == '3':
            if not tareas:
                print("Nada que eliminar.")
            else:
                idx = int(input("Número de tarea a eliminar: ")) - 1
                if 0 <= idx < len(tareas):
                    eliminada = tareas.pop(idx)
                    print(f"Eliminada: {eliminada}")
                else:
                    print("Número inválido.")
        elif opcion == '4':
            print("¡Adiós!")
            break
        else:
            print("Opción no válida.")

if __name__ == "__main__":
    gestor_tareas()
