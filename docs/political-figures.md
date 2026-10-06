# Political figures — curated profiles

Generated from `data/political-figures.json` by `node scripts/import-political-figures.mjs --docs`.
Edit the JSON, not this file. Profiles appear on `/data/entities/[id]` (biography, highlights,
aliases, born/died, sources) and in the `/people` graph via their connections.

## Adding a figure

1. Add an entry to `people` (or `organizations`) with `description`, `biography`, dated
   `highlights` (`"YYYY — event"`), `metadata`, and at least one `sources` URL.
2. Add `connections` using slugs from `src/lib/relationships.ts`.
3. `node scripts/import-political-figures.mjs --dry-run`, then without `--dry-run`
   (`ENV_FILE=.env.cloud` for production), then `--docs`.

Every claim should be dated and traceable to a listed source. Where the public record
is incomplete (e.g. a pending charge), the write-up says so rather than guessing.

## Index

| Name | Kind | Summary |
|---|---|---|
| [Jared Taylor](#jared-taylor) | pundit | Founder and editor of American Renaissance; the most prominent advocate of "race realism" and the movement's most media-polished spokesman. |
| [Thomas Rousseau](#thomas-rousseau) | pundit | Founder and leader of Patriot Front; led Vanguard America's contingent at Charlottesville at 18. |
| [Samuel Francis](#samuel-francis) | pundit | Paleoconservative columnist and theorist (1947–2005); fired by The Washington Times after an American Renaissance speech. |
| [Michael H. Hart](#michael-h-hart) | pundit | Astrophysicist and author of The 100; longtime American Renaissance attendee and advocate of racial partition, who walked out on David Duke in 2006. |
| [Robert Weissberg](#robert-weissberg) | pundit | Emeritus political scientist and longtime National Review contributor, dropped by the magazine after a 2012 American Renaissance speech. |
| [John Derbyshire](#john-derbyshire) | pundit | English-born writer and mathematician fired from National Review in 2012 over "The Talk: Nonblack Version"; later a VDARE columnist. |
| [Peter Brimelow](#peter-brimelow) | pundit | English-born financial journalist, author of Alien Nation (1995) and founder of VDARE. |
| [Kevin DeAnna](#kevin-deanna) | pundit | Founder of Youth for Western Civilization who writes for American Renaissance under the pen name "Gregory Hood." |
| [David Duke](#david-duke) | politician | Former Klan leader and one-term Louisiana state representative; the best-known figure of the American white-power movement. |
| [Don Black](#don-black) | pundit | Former Klan imperial wizard who founded Stormfront (1995), the first major white nationalist website. |
| [American Renaissance](#american-renaissance) | organization | White nationalist magazine, website and annual conference founded by Jared Taylor in 1990; it calls its outlook "race realism." |
| [Patriot Front](#patriot-front) | organization | Texas-based white nationalist group founded by Thomas Rousseau in August 2017, known for masked, uniformed flash marches and mass propaganda drops. |
| [Vanguard America](#vanguard-america) | organization | Neo-fascist group founded in 2015 by Dillon Hopper; the group Patriot Front split from in 2017. |
| [VDARE](#vdare) | organization | Immigration-restrictionist website founded by Peter Brimelow in 1999; suspended operations in 2024 under pressure from the New York attorney general. |
| [Council of Conservative Citizens](#council-of-conservative-citizens) | organization | Segregationist group founded in 1985 as the successor to the White Citizens' Councils; its website was cited by Dylann Roof. |
| [Youth for Western Civilization](#youth-for-western-civilization) | organization | Campus group founded by Kevin DeAnna with Tom Tancredo as honorary chairman; folded in the early 2010s. |

## People

### Jared Taylor

*Founder and editor of American Renaissance; the most prominent advocate of "race realism" and the movement's most media-polished spokesman.*

**Also known as:** Samuel Jared Taylor · **Born:** 1951-09-15

Samuel Jared Taylor was born on September 15, 1951, in Kobe, Japan, to missionary parents. He grew up speaking Japanese, graduated from Yale in philosophy (1973) and earned a master's in international economics from Sciences Po in Paris (1978). He worked as an international lending officer at Manufacturers Hanover and as West Coast editor of PC Magazine. His first book, Shadows of the Rising Sun (1983), was a critique of Japanese society.

In November 1990 he launched American Renaissance. Paved with Good Intentions (1992) argued that white racism does not explain Black disadvantage, and White Identity (2011) argued that racial identity is natural and inevitable. Taylor calls himself a "race realist"; civil-rights monitors and most press describe him as a white nationalist. He sets himself apart from much of the movement by speaking in a calm, academic register on mainstream TV and by not treating Jews as adversaries. That stance put him at the center of the 2006 split at his own conference.

He has been a director of the National Policy Institute, sat on the advisory board of The Occidental Quarterly, and served on the board of the Council of Conservative Citizens, acting as its spokesman after the 2015 Charleston massacre. In January 2016 he recorded robocalls backing Donald Trump before the Iowa caucuses and New Hampshire primary. He was among the first wave of deplatformed figures: Twitter in December 2017, a lost lawsuit over that ban in 2018, and YouTube in 2020. In 2019 he was barred from the Schengen Area for two years at Poland's request.

**Notable events**

- 1983 — Publishes Shadows of the Rising Sun, a critique of Japan
- 1990 — Launches American Renaissance (November)
- 1992 — Publishes Paved with Good Intentions
- 1994 — Starts the AmRen conference
- 2006 — His conference splits over David Duke's antisemitism
- 2011 — Publishes White Identity
- 2015 — Acts as Council of Conservative Citizens spokesman after the Charleston massacre
- 2016 — Records pro-Trump robocalls before Iowa and New Hampshire
- 2017 — Twitter permanently suspends him (Dec 18)
- 2018 — Sues Twitter; a state appeals court sides with Twitter on Section 230 (August)
- 2019 — Barred from the Schengen Area for two years at Poland's request
- 2020 — YouTube removes the AmRen channel

**Connections**

- Jared Taylor → *founded* → American Renaissance — Founder and editor
- Jared Taylor → *board-member-of* → Council of Conservative Citizens — Board member and spokesman

**Sources:** <https://en.wikipedia.org/wiki/Jared_Taylor> · <https://en.wikipedia.org/wiki/American_Renaissance_(magazine)> · <https://www.techdirt.com/articles/20180818/22475240459/appeals-court-says-course-twitter-can-kick-racists-off-platform.shtml>

### Thomas Rousseau

*Founder and leader of Patriot Front; led Vanguard America's contingent at Charlottesville at 18.*

**Also known as:** Thomas Ryan Rousseau · **Born:** 1998-10-20

Thomas Ryan Rousseau was born on October 20, 1998, and grew up in Grapevine, Texas, attending Coppell High School. There he was graphics editor of the school paper and wrote columns on transgender bathrooms and campus guns. As a teenager he joined Vanguard America, took control of its website and Discord server, and led its contingent at Unite the Right in August 2017. Within days he rebranded his faction as Patriot Front, which he has run ever since. He avoids formal titles, but court filings name him national director.

The January 2022 Unicorn Riot leak made public his private Discord and audio statements, and with them how the group screens recruits, assigns activity quotas and stages its marches for video. In June 2022 he was among 31 members arrested in a U-Haul near a Pride event in Coeur d'Alene, Idaho, and charged with conspiracy to riot. A magistrate dismissed his charge in November 2023, citing the prosecution's failure to turn over evidence under Brady. The state's appeal was dismissed in July 2024. In February 2024 he was booked in Waco, Texas, on a Virginia felony charge of burning an object to intimidate, for carrying a tiki torch in Charlottesville. Albemarle County sought extradition; the outcome is not on the public record.

In civil court he has fared worse. He was a named defendant in the $2.75 million Boston assault judgment (2025) and was found liable in the Arthur Ashe mural case (2026).

**Notable events**

- 2017 — Leads Vanguard America's contingent at Unite the Right, then founds Patriot Front (August)
- 2020 — Arrested in Parker County, Texas, over courthouse stickers (Aug 2)
- 2022 — Private chats and audio exposed in the Unicorn Riot leak (January)
- 2022 — Arrested with 30 members in a U-Haul near Coeur d'Alene Pride (June 11)
- 2023 — Idaho riot-conspiracy charge dismissed over Brady violations (Nov 3); state appeal dismissed July 2024
- 2024 — Booked in Waco on a Virginia felony over a Charlottesville tiki torch (February)
- 2025 — Named defendant in $2.75M Boston assault default judgment (January)
- 2026 — Found liable in the Arthur Ashe mural civil-rights case (March 31)
- 2026 — Leads Patriot Front at March for Life and a July 4 march in D.C.

**Connections**

- Thomas Rousseau → *founded* → Patriot Front — Founder and national director
- Thomas Rousseau → *former-role* → Vanguard America — Charlottesville contingent leader

**Sources:** <https://en.wikipedia.org/wiki/Thomas_Rousseau> · <https://idahocapitalsun.com/2024/02/12/how-north-idaho-prosecutors-lost-the-case-against-patriot-fronts-white-nationalist-leader/> · <https://www.rollingstone.com/politics/politics-features/patriot-front-leader-thomas-rousseau-arrested-intimidation-charges-1234976041/> · <https://www.wbur.org/news/2025/01/13/patriot-front-attack-boston-lawsuit> · <https://www.lawyerscommittee.org/arthur-ashe-mural/>

### Samuel Francis

*Paleoconservative columnist and theorist (1947–2005); fired by The Washington Times after an American Renaissance speech.*

**Also known as:** Sam Francis, Samuel T. Francis · **Died:** 2005-02-15

Samuel Todd Francis was a legislative aide to Sen. John East (R-N.C.), then an editorial writer and syndicated columnist at The Washington Times. He advised Pat Buchanan's presidential campaigns. Many on today's right use his ideas without knowing where they came from. He coined "anarcho-tyranny" (a state that fails to punish real criminals while policing law-abiding citizens) and developed the "Middle American Radicals" thesis about a disaffected white middle class, both now staples of populist-right vocabulary.

At the first American Renaissance conference in 1994 he attacked universalism and humanism for enabling "the war against the white race." Dinesh D'Souza quoted the speech in The Washington Post, and in September 1995 editor Wesley Pruden fired him. Francis then edited the Council of Conservative Citizens' Citizens Informer until his death on February 15, 2005.

**Notable events**

- 1994 — Speaks at the first American Renaissance conference
- 1995 — Fired by The Washington Times after Dinesh D'Souza publicizes the speech (September)
- 2005 — Dies (Feb 15); later rediscovered as a source of MAGA-era populist vocabulary

**Connections**

- Samuel Francis → *affiliated-with* → American Renaissance — Conference speaker (1994)
- Samuel Francis → *affiliated-with* → Council of Conservative Citizens — Editor, Citizens Informer

**Sources:** <https://en.wikipedia.org/wiki/Sam_Francis_(writer)> · <https://www.splcenter.org/resources/extremist-files/sam-francis/>

### Michael H. Hart

*Astrophysicist and author of The 100; longtime American Renaissance attendee and advocate of racial partition, who walked out on David Duke in 2006.*


Michael H. Hart is an astrophysicist best known to the general public for The 100: A Ranking of the Most Influential Persons in History (1978), a perennial bestseller. In racialist circles he is known for proposing, at American Renaissance in 1996, that the United States be partitioned into racial homelands, and for Understanding Human History (2007).

Hart is Jewish. At the February 2006 AmRen conference, David Duke used a Q&A to hint at a Jewish power behind media and government. Hart stood up, called Duke a Nazi and walked out while part of the room jeered. The episode broke the movement's uneasy truce over antisemitism and split it into a "race realist" camp and an openly antisemitic one.

**Notable events**

- 1978 — Publishes The 100
- 1996 — Proposes racial partition of the U.S. at American Renaissance
- 2006 — Confronts David Duke and walks out of the AmRen conference
- 2007 — Publishes Understanding Human History

**Connections**

- Michael H. Hart → *affiliated-with* → American Renaissance — Conference speaker and longtime attendee
- Michael H. Hart → *opposed* → David Duke — Walked out on Duke at AmRen 2006

**Sources:** <https://en.wikipedia.org/wiki/Michael_H._Hart> · <https://splcenter.org/fighting-hate/intelligence-report/2006/schism-over-anti-semitism-divides-key-white-nationalist-group-american-renaissance>

### Robert Weissberg

*Emeritus political scientist and longtime National Review contributor, dropped by the magazine after a 2012 American Renaissance speech.*


Robert Weissberg, a political scientist emeritus at the University of Illinois, wrote for National Review for years. At the 2012 American Renaissance conference he gave a talk titled "A Politically Viable Alternative to White Nationalism." He argued that a movement explicitly built on white identity was "dead on arrival" and needed repackaging to win mainstream recognition. After the Institute for Research and Education on Human Rights (IREHR) publicized the talk, editor Rich Lowry cut ties with him in April 2012, days after the magazine had fired John Derbyshire.

**Notable events**

- 2012 — Speaks at American Renaissance on repackaging white nationalism
- 2012 — Dropped by National Review after IREHR exposure (April)

**Connections**

- Robert Weissberg → *affiliated-with* → American Renaissance — Conference speaker (2012)

**Sources:** <https://irehr.org/2012/04/10/the-national-review-and-white-nationalism/> · <https://www.splcenter.org/fighting-hate/intelligence-report/2015/prominent-white-nationalists-fired-national-review>

### John Derbyshire

*English-born writer and mathematician fired from National Review in 2012 over "The Talk: Nonblack Version"; later a VDARE columnist.*


John Derbyshire was born in England in 1945 and became a U.S. citizen. He was a longtime National Review writer and the author of Prime Obsession (2003), a well-regarded popular book on the Riemann hypothesis. In April 2012, after the Trayvon Martin shooting set off columns about "the talk" Black parents give their children, he published "The Talk: Nonblack Version" in Taki's Magazine. It advised white and Asian children to avoid concentrations of Black people. National Review fired him within days. He then wrote mainly for VDARE, and his book We Are Doomed (2009) had already marked his turn to pessimistic conservatism.

**Notable events**

- 2003 — Publishes Prime Obsession on the Riemann hypothesis
- 2009 — Publishes We Are Doomed
- 2012 — Fired by National Review over "The Talk: Nonblack Version" in Taki's Magazine (April)

**Connections**

- John Derbyshire → *contributes-to* → VDARE — Columnist

**Sources:** <https://en.wikipedia.org/wiki/John_Derbyshire> · <https://www.splcenter.org/fighting-hate/intelligence-report/2015/prominent-white-nationalists-fired-national-review>

### Peter Brimelow

*English-born financial journalist, author of Alien Nation (1995) and founder of VDARE.*

**Born:** 1947-10-13

Peter Brimelow was born on October 13, 1947, in Warrington, England. He built a mainstream career as a financial journalist at Forbes and National Review, and later as a MarketWatch columnist. His Alien Nation (1995) was one of the most influential restrictionist books of the 1990s. In 1999 he founded VDARE, which became the main home for writers pushed out of conservative outlets.

In August 2018 The Washington Post reported that he had attended a birthday party at the home of White House economic adviser Larry Kudlow. Kudlow said he had not known Brimelow's views. Brimelow sued The New York Times in 2020 for calling him a white nationalist and lost. VDARE suspended operations in 2024 under investigation by the New York attorney general, who sued in 2025.

**Notable events**

- 1995 — Publishes Alien Nation
- 1999 — Founds VDARE
- 2018 — Reported attending Larry Kudlow's birthday party while Kudlow was in the White House (August)
- 2020 — Sues The New York Times over the "white nationalist" label; dismissed
- 2024 — VDARE suspends operations under New York AG investigation
- 2025 — NY AG sues VDARE over the West Virginia castle purchase

**Connections**

- Peter Brimelow → *founded* → VDARE — Founder and editor

**Sources:** <https://en.wikipedia.org/wiki/Peter_Brimelow> · <https://en.wikipedia.org/wiki/VDARE>

### Kevin DeAnna

*Founder of Youth for Western Civilization who writes for American Renaissance under the pen name "Gregory Hood."*

**Also known as:** Gregory Hood

Kevin DeAnna founded Youth for Western Civilization, a campus group with Tom Tancredo as honorary chairman. In April 2009, protesters shut down a YWC-hosted Tancredo talk at UNC Chapel Hill. As "Gregory Hood" he became one of the most prolific writers at American Renaissance, and his work is regularly reposted and podcast in the movement's ecosystem. Few readers outside it know the byline is a pseudonym, or that its author once ran a mainstream-adjacent campus conservative group.

**Notable events**

- 2009 — YWC's Tancredo event at UNC shut down by protesters (April 14)
- Writes for American Renaissance as "Gregory Hood"

**Connections**

- Kevin DeAnna → *contributes-to* → American Renaissance — Writer, as "Gregory Hood"
- Kevin DeAnna → *founded* → Youth for Western Civilization — Founder

**Sources:** <https://en.wikipedia.org/wiki/Kevin_DeAnna> · <https://en.wikipedia.org/wiki/Youth_for_Western_Civilization>

### David Duke

*Former Klan leader and one-term Louisiana state representative; the best-known figure of the American white-power movement.*

**Born:** 1950-07-01

David Ernest Duke was born on July 1, 1950, in Tulsa, Oklahoma. He joined the Klan in 1967, founded the Knights of the Ku Klux Klan in 1974, and led it as grand wizard until 1980, when he handed it to Don Black. He then rebranded himself as a suit-and-tie politician. He won a Louisiana House seat as a Republican in 1989 and served until 1992. He took 43.5% in the 1990 U.S. Senate primary and made the 1991 governor's runoff, which he lost to Edwin Edwards 61–39. That race produced the "Vote for the crook. It's important" bumper stickers. He also ran for president in 1988 and 1992.

In December 2002 he pleaded guilty to mail fraud and filing a false tax return. He had told supporters he was broke while spending their donations on gambling, and he served 15 months in Big Spring, Texas. At American Renaissance in 2006 his insinuations about Jewish power provoked Michael H. Hart's walkout and an open split in the movement. In 2016 he ran for Senate again and finished seventh with 3%, while Donald Trump's hesitation to disavow him on CNN became a campaign story. He attended Charlottesville in 2017, and YouTube and Twitter banned him in 2020.

**Notable events**

- 1974 — Founds the Knights of the Ku Klux Klan
- 1989 — Elected to the Louisiana House as a Republican
- 1991 — Loses governor's runoff to Edwin Edwards, 61–39
- 2002 — Pleads guilty to mail fraud and tax charges; 15 months in prison
- 2006 — Antisemitic remarks at American Renaissance trigger Michael Hart's walkout
- 2016 — Senate run, 3%; Trump's on-air hesitation to disavow him becomes a story
- 2017 — Attends Unite the Right in Charlottesville
- 2020 — Banned from YouTube and Twitter

**Connections**

- David Duke → *affiliated-with* → American Renaissance — Conference attendee (2006)
- David Duke → *serves-in* → Louisiana House of Representatives — State Representative
- Don Black → *succeeded* → David Duke — Klan imperial wizard (1980)
- Michael H. Hart → *opposed* → David Duke — Walked out on Duke at AmRen 2006

**Sources:** <https://en.wikipedia.org/wiki/David_Duke> · <https://splcenter.org/fighting-hate/intelligence-report/2006/schism-over-anti-semitism-divides-key-white-nationalist-group-american-renaissance>

### Don Black

*Former Klan imperial wizard who founded Stormfront (1995), the first major white nationalist website.*

**Also known as:** Stephen Donald Black · **Born:** 1953-07-28

Stephen Donald Black was born on July 28, 1953, in Athens, Alabama. At 16, on July 25, 1970, he was shot in the chest by Jerry Ray, brother of Martin Luther King Jr.'s assassin James Earl Ray. Ray claimed self-defense and was acquitted. Black joined Duke's Knights of the Ku Klux Klan in 1975 and succeeded him as imperial wizard in 1980.

On April 27, 1981, he and nine others were arrested in New Orleans preparing to sail to Dominica and overthrow its government, a plot known as Operation Red Dog. He was convicted under the Neutrality Act and served until November 1984. He learned computer programming in prison and in 1995 launched Stormfront, the internet's first significant white-nationalist site. He married Duke's ex-wife, Chloê. Their child, raised as the movement's heir apparent under the name Derek Black, publicly renounced white nationalism in 2013, a story later told in Eli Saslow's Rising Out of Hatred.

**Notable events**

- 1970 — Shot by Jerry Ray, brother of James Earl Ray (July 25)
- 1980 — Succeeds David Duke as Klan imperial wizard
- 1981 — Arrested in the plot to invade Dominica (April 27); imprisoned until 1984
- 1995 — Launches Stormfront
- 2013 — His child, raised as the movement's heir, publicly renounces it

**Connections**

- Don Black → *affiliated-with* → American Renaissance — Conference attendee
- Don Black → *succeeded* → David Duke — Klan imperial wizard (1980)

**Sources:** <https://en.wikipedia.org/wiki/Don_Black_(white_supremacist)>

## Organizations

### American Renaissance

*White nationalist magazine, website and annual conference founded by Jared Taylor in 1990; it calls its outlook "race realism."*

**Also known as:** AmRen, New Century Foundation · **Founded:** 1990

American Renaissance (AmRen) began as a monthly print newsletter in November 1990, published by Jared Taylor's New Century Foundation. It argues that races differ in intelligence and temperament and that whites should organize around racial identity. It has generally tried to present itself as more respectable than the Klan and neo-Nazi wings of the movement.

Since 1994 its conference has been one of the main places where academics, journalists and activists of the racialist right meet in person. Speaking at it has cost several speakers mainstream jobs: Samuel Francis lost his Washington Times column in 1995, and Robert Weissberg was dropped by National Review in 2012.

Hotels cancelled several of its bookings, so since 2012 the conference has met at Montgomery Bell State Park Inn, a state-owned venue in Burns, Tennessee. As a public venue it cannot easily turn the group away. Print publication ended in early 2012 and AmRen has been online-only since.

**Notable events**

- 1990 — First issue published (November), New Century Foundation as publisher
- 1994 — First AmRen conference; Samuel Francis speech later costs him his Washington Times job
- 2006 — David Duke's remarks from the floor prompt Michael H. Hart to walk out; opens an open split over antisemitism in the movement
- 2011 — Charlotte Sheraton cancels the conference after protest threats
- 2012 — Print edition ends; conference moves to Montgomery Bell State Park, Tennessee
- 2012 — Robert Weissberg's AmRen talk gets him dropped by National Review
- 2017 — Twitter suspends AmRen and Taylor (Dec 18)
- 2020 — YouTube removes the AmRen channel (late June)

**Connections**

- Jared Taylor → *founded* → American Renaissance — Founder and editor
- Kevin DeAnna → *contributes-to* → American Renaissance — Writer, as "Gregory Hood"
- Samuel Francis → *affiliated-with* → American Renaissance — Conference speaker (1994)
- Michael H. Hart → *affiliated-with* → American Renaissance — Conference speaker and longtime attendee
- Robert Weissberg → *affiliated-with* → American Renaissance — Conference speaker (2012)
- David Duke → *affiliated-with* → American Renaissance — Conference attendee (2006)
- Don Black → *affiliated-with* → American Renaissance — Conference attendee

**Sources:** <https://en.wikipedia.org/wiki/American_Renaissance_(magazine)> · <https://splcenter.org/fighting-hate/intelligence-report/2006/schism-over-anti-semitism-divides-key-white-nationalist-group-american-renaissance> · <https://www.newschannel5.com/news/newschannel-5-investigates/confronting-hate/inside-the-influential-white-supremacist-conference-that-calls-tennessee-home-away-from-home>

### Patriot Front

*Texas-based white nationalist group founded by Thomas Rousseau in August 2017, known for masked, uniformed flash marches and mass propaganda drops.*

**Founded:** 2017

Patriot Front was formed in August 2017, in the days after the Unite the Right rally in Charlottesville. Thomas Rousseau, who had led Vanguard America's contingent there, rebranded his faction of that group. The Discord message announcing the change said the focus and goals would stay the same. The group wraps white nationalism in Revolutionary-era American iconography: fasces logos, "Reclaim America" slogans and khaki-and-navy uniforms with face coverings.

Its signature tactics are unannounced "flash marches" in city centers (Philadelphia, Boston, Washington), tightly choreographed and filmed for propaganda, plus mass stickering and flyering. Since 2019 the ADL has attributed the majority of white supremacist propaganda incidents in the U.S. to Patriot Front.

In January 2022 Unicorn Riot published roughly 400 GB of the group's internal chats, audio and documents. The leak exposed its recruitment vetting, its activity quotas and Rousseau's private statements. Civil suits brought under the 1871 Ku Klux Klan Act have since produced judgments against the group in Massachusetts and Virginia.

**Notable events**

- 2017 — Founded in August after Unite the Right as a rebrand of Rousseau's Vanguard America faction
- 2021 — Vandalizes the Arthur Ashe mural in Richmond's Battery Park (October); July 4th-weekend Philadelphia march ends with members chased off
- 2022 — Unicorn Riot leak of ~400 GB of internal chats and recordings (January)
- 2022 — 31 members arrested in a U-Haul near Coeur d'Alene Pride (June 11)
- 2022 — Boston flash march; Black musician Charles Murrell assaulted (July)
- 2025 — $2.75M default judgment for Murrell under the KKK Act (January 13)
- 2026 — Marches at March for Life (January 23) and through D.C. on July 4
- 2026 — Federal court orders $470K+ in the Ashe mural case (March 31)

**Connections**

- Thomas Rousseau → *founded* → Patriot Front — Founder and national director

**Sources:** <https://en.wikipedia.org/wiki/Patriot_Front> · <https://www.adl.org/resources/backgrounder/patriot-front> · <https://www.wbur.org/news/2025/01/13/patriot-front-attack-boston-lawsuit> · <https://www.lawyerscommittee.org/arthur-ashe-mural/> · <https://www.12onyourside.com/2026/04/03/federal-judge-orders-patriot-front-pay-470000-arthur-ashe-mural-vandalism/> · <https://azmirror.com/2022/01/24/arizona-ties-emerge-in-leak-of-posts-on-white-supremacist-forum/>

### Vanguard America

*Neo-fascist group founded in 2015 by Dillon Hopper; the group Patriot Front split from in 2017.*

**Founded:** 2015

Vanguard America was founded in 2015 by Dillon Hopper, a Marine veteran. Before Unite the Right, Thomas Rousseau took control of its website and Discord server and led its contingent in Charlottesville on August 12, 2017. James Alex Fields Jr. was photographed that day marching with a Vanguard America shield, hours before he drove his car into counter-protesters and killed Heather Heyer. The group denied that he was a member. Within days Rousseau's faction had broken off and rebranded as Patriot Front.

**Notable events**

- 2015 — Founded by Dillon Hopper
- 2017 — Rousseau takes over its web presence and Discord before Charlottesville
- 2017 — James Fields photographed with a Vanguard America shield on Aug 12; group denies membership
- 2017 — Rousseau faction splits off as Patriot Front

**Connections**

- Thomas Rousseau → *former-role* → Vanguard America — Charlottesville contingent leader

**Sources:** <https://en.wikipedia.org/wiki/Vanguard_America> · <https://en.wikipedia.org/wiki/Thomas_Rousseau>

### VDARE

*Immigration-restrictionist website founded by Peter Brimelow in 1999; suspended operations in 2024 under pressure from the New York attorney general.*

**Also known as:** VDARE Foundation · **Founded:** 1999

VDARE was founded in 1999 by Peter Brimelow and named for Virginia Dare, the first English child born in the Americas (1587). It was the main web home for writers such as Steve Sailer and John Derbyshire after mainstream outlets dropped them, and it blurred the line between immigration restrictionism and white nationalism.

In 2020 the VDARE Foundation bought a castle in Berkeley Springs, West Virginia, as a venue. Venues kept cancelling on the movement, so owning one was a recurring goal. New York attorney general Letitia James opened an investigation, and VDARE suspended operations in July 2024, citing the cost of that investigation. In August 2025 her office sued, alleging misuse of about $1.4 million of charitable funds tied to the property purchase.

**Notable events**

- 1999 — Founded by Peter Brimelow
- 2020 — Buys a castle in Berkeley Springs, West Virginia
- 2024 — Suspends operations, citing the New York AG investigation (July)
- 2025 — NY AG sues over ~$1.4M in alleged misused charitable funds (August)

**Connections**

- Peter Brimelow → *founded* → VDARE — Founder and editor
- John Derbyshire → *contributes-to* → VDARE — Columnist

**Sources:** <https://en.wikipedia.org/wiki/VDARE> · <https://en.wikipedia.org/wiki/Peter_Brimelow>

### Council of Conservative Citizens

*Segregationist group founded in 1985 as the successor to the White Citizens' Councils; its website was cited by Dylann Roof.*

**Also known as:** CofCC · **Founded:** 1985

The Council of Conservative Citizens (CofCC) was founded in St. Louis in 1985 by Gordon Lee Baum, using the mailing lists of the old White Citizens' Councils. For years it kept unusually close ties to elected Southern Republicans and Democrats. In 1998–99 it emerged that Senate Majority Leader Trent Lott had addressed CofCC gatherings, telling one in 1992 that "the people in this room stand for the right principles and the right philosophy," and that Rep. Bob Barr had given a keynote at its 1998 national meeting.

In June 2015 Dylann Roof's manifesto credited the CofCC website's coverage of "black-on-white crime" with awakening him, shortly before he murdered nine people at Mother Emanuel AME Church in Charleston. Reporters then found that CofCC president Earl Holt had donated to Ted Cruz, Rand Paul and Rick Santorum, among others. Those campaigns returned or redirected the money. Jared Taylor acted as the group's spokesman during that period.

**Notable events**

- 1985 — Founded in St. Louis by Gordon Baum from White Citizens' Council lists
- 1992 — Trent Lott tells a CofCC audience they "stand for the right principles" (surfaced 1998–99)
- 1998 — Rep. Bob Barr keynotes the CofCC national meeting
- 2015 — Dylann Roof's manifesto cites the CofCC website (June)
- 2015 — President Earl Holt's GOP donations surface; Cruz, Paul, Santorum give the money back or away

**Connections**

- Jared Taylor → *board-member-of* → Council of Conservative Citizens — Board member and spokesman
- Samuel Francis → *affiliated-with* → Council of Conservative Citizens — Editor, Citizens Informer
- Bob Barr → *affiliated-with* → Council of Conservative Citizens — Keynote speaker, national meeting (1998)
- Trent Lott → *affiliated-with* → Council of Conservative Citizens — Addressed CofCC gatherings (1992 remarks)

**Sources:** <https://en.wikipedia.org/wiki/Council_of_Conservative_Citizens>

### Youth for Western Civilization

*Campus group founded by Kevin DeAnna with Tom Tancredo as honorary chairman; folded in the early 2010s.*


Youth for Western Civilization (YWC) organized chapters on college campuses in the late 2000s around immigration restriction and defense of "Western civilization." Former Colorado congressman Tom Tancredo was its honorary chairman. On April 14, 2009, at UNC Chapel Hill, protesters shut down a Tancredo talk hosted by YWC, and campus police used pepper spray. The incident became a national campus-speech story. YWC's founder, Kevin DeAnna, later wrote for American Renaissance as "Gregory Hood."

**Notable events**

- 2009 — Tancredo talk at UNC Chapel Hill shut down by protesters; police use pepper spray (April 14)

**Connections**

- Kevin DeAnna → *founded* → Youth for Western Civilization — Founder

**Sources:** <https://en.wikipedia.org/wiki/Youth_for_Western_Civilization> · <https://splcenter.org/hatewatch/2009/04/21/protesters-shut-down-tancredo-speech-unc>
