# Theory of Computation Notes  

## Introduction  
The **Theory of Computation** is a branch of computer science that studies the **fundamental capabilities and limitations of computers**. It answers questions like:  
- *What can be computed?*  
- *How efficiently can it be computed?*  
- *What problems are impossible to solve?*  

This field provides the theoretical foundation for understanding algorithms, programming languages, compilers, and artificial intelligence.  

---

## Automata Theory  
### Finite Automata  
A **finite automaton** (or finite state machine) is a model of computation that recognizes patterns in input strings.  

#### Deterministic Finite Automaton (DFA)  
- **Definition**: A DFA is defined by five components:  
  1. A finite set of states.  
  2. A finite set of input symbols (alphabet).  
  3. A transition function (state transition logic).  
  4. A start state.  
  5. A set of accept states.  

  ```none
  DFA = (Q, Σ, δ, q0, F)
  ```  
  Where:  
  - `Q` = set of states  
  - `Σ` = input alphabet  
  - `δ` = transition function  
  - `q0` = initial state  
  - `F` = set of accept states  

#### Nondeterministic Finite Automaton (NFA)  
- Allows **multiple possible transitions** for a given state and input symbol.  
- **Key difference**: Easier to construct than a DFA but equivalent in computational power.  

### Pushdown Automata  
A **pushdown automaton (PDA)** extends finite automata by using a **stack** to store information.  

- **Purpose**: Recognizes **context-free languages** (e.g., balancing parentheses).  
- PDA can simulate contexts like recursion (unlike finite automata).  

---

## Formal Languages and Grammars  
### Chomsky Hierarchy  
Formal languages are classified into four types based on their grammars:  

| **Type**               | **Grammar**              | **Recognized By**       |  
|------------------------|--------------------------|-------------------------|  
| Type-0 (Recursively Enumerable) | Untyped context-sensitive | Turing Machines         |  
| Type-1 (Context-Sensitive)| Context-sensitive        | Linear-Bounded Automata |  
| Type-2 (Context-Free)   | Context-free grammars     | Pushdown Automata       |  
| Type-3 (Regular)        | Regular grammars          | Finite Automata         |  

### Regular Expressions  
A notation to represent regular languages. Key rules:  
- Union: `A | B`  
- Concatenation: `AB`  
- Kleene Star: `A*`  

Example: `01*(10)*1` represents all strings starting and ending with `1` separated by any number of `01` or `10`.  

---

## Computability Theory  
### Turing Machines  
A **Turing Machine (TM)** is a theoretical model that can simulate any algorithm.  

- Consists of:  
  1. Infinite tape (input/output).  
  2. Tape head (reads/writes symbols).  
  3. State register (current state of the machine).  

- Key properties:  
  - Can compute any computable function.  
  - Some problems are **undecidable** (e.g., the Halting Problem).  

### Decidability and Undecidability  
- **Decidable problems**: Algorithms exist to solve them (e.g., DFA acceptance).  
- **Undecidable problems**: No algorithm can solve them (e.g., the Halting Problem).  

---

## Complexity Theory  
### Time and Space Complexity  
Measures the efficiency of algorithms:  
- **Time Complexity**: How many steps an algorithm takes.  
- **Space Complexity**: How much memory it uses.  

#### Big O Notation  
- Describes worst-case performance:  
  - `O(1)`: Constant time  
  - `O(n)`: Linear time  
  - `O(n²)`: Quadratic time  

### P vs NP Problem  
- **P**: Problems solvable in polynomial time.  
- **NP**: Problems whose solutions can be verified in polynomial time.  
- The $P \neq NP$ question remains unsolved.  

### NP-Completeness  
A problem is **NP-complete** if:  
1. It is in NP.  
2. Every NP problem can be reduced to it in polynomial time.  

Examples:  
- Traveling Salesman Problem (TSP)  
- Boolean Satisfiability (SAT)  

---

## Applications of Theory of Computation  
1. **Compilers**: Use formal grammars (e.g., parsing context-free grammars).  
2. **Cryptography**: Relies on computational hardness assumptions.  
3. **AI**: Computability guides what problems machines can solve.  

---

## Conclusion  
The Theory of Computation is essential for understanding the **limits of what computers can achieve**. By studying automata, languages, computability, and complexity, we gain insights into both theoretical and practical aspects of computing.  

### Key Takeaways  
- Finite Automata and Turing Machines model different levels of computation.  
- Context-free languages expand the power to recognize nested structures.  
- Complexity theory guides efficient algorithm design.  
- Undecidable problems highlight inherent boundaries in computation.  

Let me know if you'd like to expand any section! 😊
