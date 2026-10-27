import { h, type TraditionCore } from "./types";

// Regime traditions and national-developmental movements outside the
// Western left–right families.

export const WORLD: Record<string, TraditionCore> = {
  "state-capitalism": h({
    when: "1978",
    where: "China",
    founders: ["Deng Xiaoping"],
    figures: ["Deng Xiaoping", "Chen Yun", "Wang Huning"],
    texts: [
      ["\"Emancipate the Mind, Seek Truth from Facts\"", "Deng Xiaoping", "1978"],
      ["Southern Tour talks", "Deng Xiaoping", "1992"],
      ["The Governance of China", "Xi Jinping", "2014"],
    ],
    timeline: [
      ["1978", "Deng launches \"reform and opening\"; the first special economic zones follow in 1980."],
      ["1986", "Vietnam begins its Đổi Mới market reforms."],
      ["1989", "The army crushes the Tiananmen Square protests."],
      ["1992", "Deng's Southern Tour restarts market reform."],
      ["2001", "China joins the World Trade Organization."],
      ["2018", "China abolishes presidential term limits."],
    ],
    practice: [
      ["People's Republic of China", "1978–present"],
      ["Vietnam", "1986–present"],
      ["Laos", "1986–present"],
    ],
  }),
  developmentalism: h({
    when: "1960s",
    where: "East Asia",
    founders: ["Park Chung-hee", "Lee Kuan Yew", "Chiang Ching-kuo"],
    figures: ["Friedrich List", "Chalmers Johnson", "Alice Amsden"],
    texts: [
      ["MITI and the Japanese Miracle", "Chalmers Johnson", "1982"],
      ["From Third World to First", "Lee Kuan Yew", "2000"],
    ],
    timeline: [
      ["1961", "Park Chung-hee seizes power in South Korea; the first five-year plan begins in 1962."],
      ["1965", "Singapore becomes independent under Lee Kuan Yew."],
      ["1972", "Park's Yushin constitution gives him near-unlimited power."],
      ["1987", "South Korea democratizes."],
      ["2000", "Paul Kagame becomes president of Rwanda and pursues a state-led development model."],
    ],
    practice: [
      ["South Korea under Park", "1961–1979"],
      ["Singapore under the People's Action Party", "1959–present"],
      ["Taiwan under the Kuomintang", "1949–1987"],
      ["Rwanda under Kagame", "2000–present"],
    ],
  }),
  kemalism: h({
    when: "1919–1937",
    where: "Turkey",
    founders: ["Mustafa Kemal Atatürk"],
    figures: ["Mustafa Kemal Atatürk", "İsmet İnönü", "Ziya Gökalp (influence)"],
    texts: [
      ["The Principles of Turkism", "Ziya Gökalp", "1923"],
      ["Nutuk (The Great Speech)", "Mustafa Kemal Atatürk", "1927"],
    ],
    timeline: [
      ["1923", "The Republic of Turkey is proclaimed."],
      ["1924", "The caliphate is abolished."],
      ["1928", "Turkey adopts the Latin alphabet."],
      ["1934", "Women gain the vote in national elections; Turks are required to take surnames."],
      ["1937", "The Six Arrows of Kemalism are written into the constitution."],
      ["1960", "The army stages the first of several coups in Kemalism's name."],
    ],
    practice: [
      ["Republican People's Party (CHP)", "Turkey, 1923–present"],
      ["Single-party Turkey", "1923–1946"],
      ["Turkish military", "Coups in 1960, 1971, and 1980"],
    ],
  }),
  "military-rule": h({
    when: "Recurring; the modern \"bureaucratic-authoritarian\" model from the 1960s",
    where: "Latin America, the Middle East, Africa, and Southeast Asia",
    founders: ["Gamal Abdel Nasser (Free Officers)", "Humberto Castelo Branco (Brazil)"],
    figures: ["Gamal Abdel Nasser", "Golbery do Couto e Silva", "Augusto Pinochet"],
    texts: [
      ["The Philosophy of the Revolution", "Gamal Abdel Nasser", "1954"],
      ["Political Order in Changing Societies", "Samuel Huntington", "1968"],
      ["Declaration of Principles of the Government of Chile", "Chilean military junta", "1974"],
    ],
    timeline: [
      ["1952", "Egypt's Free Officers overthrow the monarchy."],
      ["1964", "Brazil's military takes power and rules for 21 years."],
      ["1973", "Pinochet's coup in Chile."],
      ["1976", "Argentina's junta begins the \"Dirty War\"."],
      ["2013", "Egypt's army removes President Morsi."],
      ["2021", "Myanmar's military seizes power."],
    ],
    practice: [
      ["Chile under Pinochet", "1973–1990"],
      ["Brazil's military regime", "1964–1985"],
      ["Indonesia under Suharto", "1967–1998"],
      ["Myanmar's junta", "1962–2011 and 2021–present"],
    ],
  }),
  bolivarianism: h({
    when: "1982–1999",
    where: "Venezuela",
    founders: ["Hugo Chávez"],
    figures: ["Simón Bolívar", "Hugo Chávez", "Heinz Dieterich"],
    texts: [
      ["Jamaica Letter", "Simón Bolívar", "1815"],
      ["Angostura Address", "Simón Bolívar", "1819"],
      ["Constitution of the Bolivarian Republic of Venezuela", "Constituent Assembly", "1999"],
      ["Plan de la Patria", "Hugo Chávez", "2012"],
    ],
    timeline: [
      ["1982", "Chávez and fellow officers found the Revolutionary Bolivarian Movement-200."],
      ["1992", "Chávez leads a failed coup."],
      ["1998", "Chávez wins the presidency."],
      ["1999", "A new constitution renames the country the Bolivarian Republic of Venezuela."],
      ["2013", "Chávez dies; Maduro succeeds him."],
      ["2024", "Maduro claims a disputed re-election."],
    ],
    practice: [
      ["Venezuela under the PSUV", "1999–present"],
      ["ALBA", "Regional alliance, 2004–present"],
      ["Ecuador's \"Citizens' Revolution\"", "Correa, 2007–2017"],
    ],
  }),
  peronism: h({
    when: "1943–1946",
    where: "Argentina",
    founders: ["Juan Perón", "Eva Perón"],
    figures: ["Juan Perón", "Eva Perón", "Arturo Jauretche"],
    texts: [
      ["The Twenty Truths of Justicialism", "Juan Perón", "1950"],
      ["La razón de mi vida", "Eva Perón", "1951"],
      ["Conducción política", "Juan Perón", "1951"],
    ],
    timeline: [
      ["1945", "A mass rally on October 17 frees Perón from detention."],
      ["1946", "Perón wins the presidency."],
      ["1949", "A new constitution enshrines workers' rights and state control of resources."],
      ["1955", "The military overthrows Perón."],
      ["1973", "Perón returns from exile and wins a third term."],
      ["2003", "Néstor Kirchner begins twelve years of Kirchnerist government."],
    ],
    practice: [
      ["Justicialist Party", "Argentina, 1946–present"],
      ["CGT union confederation", "Argentina"],
      ["Menem and Kirchner governments", "1989–1999 and 2003–2015"],
    ],
  }),
  "constitutional-monarchism": h({
    when: "1689",
    where: "England",
    founders: ["Framers of the Bill of Rights 1689", "Montesquieu (theory)", "Walter Bagehot"],
    figures: ["Montesquieu", "Benjamin Constant", "Walter Bagehot"],
    texts: [
      ["Bill of Rights", "Parliament of England", "1689"],
      ["The Spirit of the Laws", "Montesquieu", "1748"],
      ["Constitutional Charter", "Louis XVIII", "1814"],
      ["The English Constitution", "Walter Bagehot", "1867"],
    ],
    timeline: [
      ["1215", "Magna Carta limits the English crown."],
      ["1689", "The Bill of Rights subordinates the crown to Parliament."],
      ["1849", "Denmark becomes a constitutional monarchy."],
      ["1947", "Japan's postwar constitution makes the emperor a symbol of the state."],
      ["1978", "Spain's constitution restores democratic monarchy after Franco."],
    ],
    practice: [
      ["United Kingdom", "1689–present"],
      ["Spain", "1978–present"],
      ["Japan", "1947–present"],
      ["Scandinavian monarchies and the Netherlands", "19th century–present"],
    ],
  }),
  baathism: h({
    when: "1940–1947",
    where: "Damascus",
    founders: ["Michel Aflaq", "Salah al-Din al-Bitar", "Zaki al-Arsuzi"],
    figures: ["Michel Aflaq", "Salah al-Din al-Bitar", "Zaki al-Arsuzi"],
    texts: [
      ["Constitution of the Ba'ath Party", "Ba'ath Party", "1947"],
      ["On the Way of Resurrection", "Michel Aflaq", "1959"],
    ],
    timeline: [
      ["1947", "The Arab Ba'ath Party holds its founding congress in Damascus."],
      ["1963", "Ba'athist coups take power in Syria and Iraq."],
      ["1966", "The party splits into rival Syrian and Iraqi branches."],
      ["1970", "Hafez al-Assad seizes power in Syria."],
      ["2003", "The U.S. invasion ends Ba'athist rule in Iraq."],
      ["2024", "Rebels overthrow Bashar al-Assad."],
    ],
    practice: [
      ["Ba'athist Syria", "1963–2024"],
      ["Ba'athist Iraq", "1968–2003"],
    ],
  }),
};
