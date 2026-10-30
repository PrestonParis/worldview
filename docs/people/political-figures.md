# Political figures — curated profiles

Generated from the `data/political-*.json` collections by `node scripts/import-political-figures.mjs --docs`.
Edit those JSON files, not this document. Profiles appear on `/subpoena/[slug]` (biography, highlights,
aliases, born/died, sources) and in the `/people` page via their connections.

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
| [David Duke](#david-duke) | politician | Former Klan leader and one-term Louisiana state representative; the best-known figure of the American White-power movement. |
| [Don Black](#don-black) | pundit | Former Klan imperial wizard who founded Stormfront (1995), the first major White nationalist website. |
| [Elon Musk](#elon-musk) | donor | Technology executive who leads SpaceX and Tesla and owns X; the largest disclosed individual political donor of the 2024 federal election cycle. |
| [Peter Thiel](#peter-thiel) | donor | Co-founder of PayPal and Palantir, Founders Fund partner and Republican donor; financed the 2022 Senate campaigns of former employees JD Vance and Blake Masters. |
| [Timothy Mellon](#timothy-mellon) | donor | Banking-family heir and transportation businessman who became one of the largest disclosed donors in the 2024 election, principally supporting Donald Trump and Robert F. Kennedy Jr. |
| [Miriam Adelson](#miriam-adelson) | donor | Physician, controlling shareholder of Las Vegas Sands, and one of the Republican Party's largest donors through election groups including Preserve America. |
| [Richard Uihlein](#richard-uihlein) | donor | Co-founder of the shipping-supplies company Uline and a major financier of Republican candidates and conservative outside groups. |
| [Elizabeth Uihlein](#elizabeth-uihlein) | donor | President and co-founder of Uline and, with Richard Uihlein, a major donor to Republican candidates and conservative political organizations. |
| [Ken Griffin](#ken-griffin) | donor | Founder and chief executive of Citadel and one of the largest Republican donors in recent federal election cycles. |
| [Jeff Yass](#jeff-yass) | donor | Co-founder of Susquehanna International Group, major Republican and libertarian donor, and a prominent investor in TikTok parent ByteDance. |
| [Charles Koch](#charles-koch) | donor | Chairman of Koch, Inc. and principal builder of a large libertarian and conservative policy, advocacy, academic and electoral network. |
| [Paul Singer](#paul-singer) | donor | Founder of Elliott Investment Management and a major Republican donor with longstanding influence in conservative policy and pro-Israel organizations. |
| [Stephen Schwarzman](#stephen-schwarzman) | donor | Co-founder and chief executive of Blackstone and a major Republican donor with influence in business, education and U.S.-China policy circles. |
| [Larry Ellison](#larry-ellison) | donor | Oracle co-founder and longtime Republican donor whose influence spans technology, national security contracting, media investments and electoral politics. |
| [George Soros](#george-soros) | donor | Investor and founder of the Open Society Foundations, with decades of major giving to Democratic candidates, civil-society organizations and progressive causes. |
| [Alex Soros](#alex-soros) | donor | Chair of the Open Society Foundations and political donor who now leads much of the Soros family's institutional and electoral activity. |
| [Michael Bloomberg](#michael-bloomberg) | politician | Bloomberg LP founder, former New York City mayor, presidential candidate, and major Democratic donor focused on gun policy, climate and public health. |
| [Reid Hoffman](#reid-hoffman) | donor | LinkedIn co-founder and venture capitalist who is one of the technology industry's most active funders of Democratic candidates and political organizations. |
| [Dustin Moskovitz](#dustin-moskovitz) | donor | Facebook and Asana co-founder whose political giving and Open Philanthropy funding make him a major Democratic and policy donor. |
| [Laurene Powell Jobs](#laurene-powell-jobs) | donor | Founder of Emerson Collective, using philanthropy, investment and media ownership to influence immigration, education, climate and civic policy. |
| [Pierre Omidyar](#pierre-omidyar) | donor | eBay founder whose Democracy Fund, Omidyar Network and media investments support election administration, journalism and civic institutions. |
| [Donald Sussman](#donald-sussman) | donor | Founder of Paloma Partners and a longstanding major donor to Democratic candidates, party committees and progressive outside groups. |
| [Marc Andreessen](#marc-andreessen) | donor | Venture capitalist and Andreessen Horowitz co-founder whose money and public advocacy shape technology, cryptocurrency, defense and Republican policy debates. |
| [David Sacks](#david-sacks) | donor | Venture capitalist, former PayPal executive, political fundraiser, and White House special adviser for artificial intelligence and cryptocurrency. |
| [Harlan Crow](#harlan-crow) | donor | Texas real-estate executive and Republican donor whose undisclosed gifts and financial ties to Justice Clarence Thomas drew national scrutiny. |
| [Barre Seid](#barre-seid) | donor | Industrialist whose transfer of a company worth roughly $1.6 billion created one of the largest known political donations, funding the Marble Freedom Trust. |
| [John Arnold](#john-arnold) | donor | Former energy trader and co-founder of Arnold Ventures, a major policy philanthropy working on criminal justice, health care, public finance and evidence-based government. |
| [Laura Arnold](#laura-arnold) | donor | Attorney and co-founder of Arnold Ventures, directing major policy funding in criminal justice, health care, public finance and government effectiveness. |
| [Robert Mercer](#robert-mercer) | donor | Computer scientist and former Renaissance Technologies executive who financed conservative campaigns, Breitbart and data firm Cambridge Analytica. |
| [Rebekah Mercer](#rebekah-mercer) | donor | Conservative donor and foundation director who helped steer Mercer-family funding to campaigns, Breitbart and political organizations. |
| [Tom Steyer](#tom-steyer) | politician | Former hedge-fund manager, climate activist, Democratic megadonor and 2020 presidential candidate. |
| [Eric Schmidt](#eric-schmidt) | donor | Former Google chief executive and major technology-policy philanthropist with influence in artificial intelligence, national security and Democratic politics. |
| [Vinod Khosla](#vinod-khosla) | donor | Sun Microsystems co-founder and venture capitalist active in Democratic fundraising and policy debates over climate, health and artificial intelligence. |
| [Joe Lonsdale](#joe-lonsdale) | donor | Palantir and 8VC co-founder who funds Republican candidates and organizations connecting Silicon Valley, defense technology and conservative policy. |
| [Palmer Luckey](#palmer-luckey) | donor | Founder of Oculus and Anduril Industries, Republican donor, and influential advocate for defense technology and military procurement reform. |
| [American Renaissance](#american-renaissance) | organization | White nationalist magazine, website and annual conference founded by Jared Taylor in 1990; it calls its outlook "race realism." |
| [Patriot Front](#patriot-front) | organization | Texas-based White nationalist group founded by Thomas Rousseau in August 2017, known for masked, uniformed flash marches and mass propaganda drops. |
| [Vanguard America](#vanguard-america) | organization | Neo-fascist group founded in 2015 by Dillon Hopper; the group Patriot Front split from in 2017. |
| [VDARE](#vdare) | organization | Immigration-restrictionist website founded by Peter Brimelow in 1999; suspended operations in 2024 under pressure from the New York attorney general. |
| [Council of Conservative Citizens](#council-of-conservative-citizens) | organization | Segregationist group founded in 1985 as the successor to the White Citizens' Councils; its website was cited by Dylann Roof. |
| [Youth for Western Civilization](#youth-for-western-civilization) | organization | Campus group founded by Kevin DeAnna with Tom Tancredo as honorary chairman; folded in the early 2010s. |

## People

### Jared Taylor

*Founder and editor of American Renaissance; the most prominent advocate of "race realism" and the movement's most media-polished spokesman.*

**Also known as:** Samuel Jared Taylor · **Born:** 1951-09-15

Samuel Jared Taylor was born on September 15, 1951, in Kobe, Japan, to missionary parents. He grew up speaking Japanese, graduated from Yale in philosophy (1973) and earned a master's in international economics from Sciences Po in Paris (1978). He worked as an international lending officer at Manufacturers Hanover and as West Coast editor of PC Magazine. His first book, Shadows of the Rising Sun (1983), was a critique of Japanese society.

In November 1990 he launched American Renaissance. Paved with Good Intentions (1992) argued that White racism does not explain Black disadvantage, and White Identity (2011) argued that racial identity is natural and inevitable. Taylor calls himself a "race realist"; civil-rights monitors and most press describe him as a White nationalist. He sets himself apart from much of the movement by speaking in a calm, academic register on mainstream TV and by not treating Jews as adversaries. That stance put him at the center of the 2006 split at his own conference.

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

Samuel Todd Francis was a legislative aide to Sen. John East (R-N.C.), then an editorial writer and syndicated columnist at The Washington Times. He advised Pat Buchanan's presidential campaigns. Many on today's right use his ideas without knowing where they came from. He coined "anarcho-tyranny" (a state that fails to punish real criminals while policing law-abiding citizens) and developed the "Middle American Radicals" thesis about a disaffected White middle class, both now staples of populist-right vocabulary.

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


Robert Weissberg, a political scientist emeritus at the University of Illinois, wrote for National Review for years. At the 2012 American Renaissance conference he gave a talk titled "A Politically Viable Alternative to White Nationalism." He argued that a movement explicitly built on White identity was "dead on arrival" and needed repackaging to win mainstream recognition. After the Institute for Research and Education on Human Rights (IREHR) publicized the talk, editor Rich Lowry cut ties with him in April 2012, days after the magazine had fired John Derbyshire.

**Notable events**

- 2012 — Speaks at American Renaissance on repackaging White nationalism
- 2012 — Dropped by National Review after IREHR exposure (April)

**Connections**

- Robert Weissberg → *affiliated-with* → American Renaissance — Conference speaker (2012)

**Sources:** <https://irehr.org/2012/04/10/the-national-review-and-white-nationalism/> · <https://www.splcenter.org/fighting-hate/intelligence-report/2015/prominent-white-nationalists-fired-national-review>

### John Derbyshire

*English-born writer and mathematician fired from National Review in 2012 over "The Talk: Nonblack Version"; later a VDARE columnist.*


John Derbyshire was born in England in 1945 and became a U.S. citizen. He was a longtime National Review writer and the author of Prime Obsession (2003), a well-regarded popular book on the Riemann hypothesis. In April 2012, after the Trayvon Martin shooting set off columns about "the talk" Black parents give their children, he published "The Talk: Nonblack Version" in Taki's Magazine. It advised White and Asian children to avoid concentrations of Black people. National Review fired him within days. He then wrote mainly for VDARE, and his book We Are Doomed (2009) had already marked his turn to pessimistic conservatism.

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

In August 2018 The Washington Post reported that he had attended a birthday party at the home of White House economic adviser Larry Kudlow. Kudlow said he had not known Brimelow's views. Brimelow sued The New York Times in 2020 for calling him a White nationalist and lost. VDARE suspended operations in 2024 under investigation by the New York attorney general, who sued in 2025.

**Notable events**

- 1995 — Publishes Alien Nation
- 1999 — Founds VDARE
- 2018 — Reported attending Larry Kudlow's birthday party while Kudlow was in the White House (August)
- 2020 — Sues The New York Times over the "White nationalist" label; dismissed
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

*Former Klan leader and one-term Louisiana state representative; the best-known figure of the American White-power movement.*

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

*Former Klan imperial wizard who founded Stormfront (1995), the first major White nationalist website.*

**Also known as:** Stephen Donald Black · **Born:** 1953-07-28

Stephen Donald Black was born on July 28, 1953, in Athens, Alabama. At 16, on July 25, 1970, he was shot in the chest by Jerry Ray, brother of Martin Luther King Jr.'s assassin James Earl Ray. Ray claimed self-defense and was acquitted. Black joined Duke's Knights of the Ku Klux Klan in 1975 and succeeded him as imperial wizard in 1980.

On April 27, 1981, he and nine others were arrested in New Orleans preparing to sail to Dominica and overthrow its government, a plot known as Operation Red Dog. He was convicted under the Neutrality Act and served until November 1984. He learned computer programming in prison and in 1995 launched Stormfront, the internet's first significant White-nationalist site. He married Duke's ex-wife, Chloê. Their child, raised as the movement's heir apparent under the name Derek Black, publicly renounced White nationalism in 2013, a story later told in Eli Saslow's Rising Out of Hatred.

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

### Elon Musk

*Technology executive who leads SpaceX and Tesla and owns X; the largest disclosed individual political donor of the 2024 federal election cycle.*

**Born:** 1971-06-28

Elon Musk built his wealth through technology companies including PayPal, SpaceX and Tesla, and acquired Twitter, now X, in 2022. In 2024 he created and largely financed America PAC, backed Donald Trump and Republican candidates, and became the cycle's largest disclosed individual political donor. His political influence also comes from ownership of X and from companies with major federal contracts and regulatory interests.

**Notable events**

- 2022 — Acquires Twitter, later renamed X
- 2024 — Creates and funds America PAC
- 2024 — Becomes the largest disclosed individual donor of the federal election cycle

**Sources:** <https://apnews.com/article/d248547966bf9c6daf6f5d332bc4be66> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Peter Thiel

*Co-founder of PayPal and Palantir, Founders Fund partner and Republican donor; financed the 2022 Senate campaigns of former employees JD Vance and Blake Masters.*

**Born:** 1967-10-11

Co-founder of PayPal and Palantir and Facebook's first outside investor. Since 2000 he has made more than $50 million in itemized federal political contributions, nearly all to Republican candidates and committees, including $35 million to two super PACs that backed the 2022 Senate campaigns of former employees JD Vance and Blake Masters. The full structured profile lives in data/profiles/peter-thiel.json (scripts/import-profile.mjs).

**Notable events**

- 1987 — Co-founds the Stanford Review while an undergraduate at Stanford
- 1998 — Co-founds Confinity, the company that becomes PayPal
- 2002 — PayPal is acquired by eBay
- 2003 — Co-founds Palantir and becomes chairman
- 2004 — Makes Facebook's first major outside investment
- 2005 — Helps launch Founders Fund
- 2016 — Endorses Donald Trump and speaks at the Republican National Convention
- 2022 — Spends most of $35 million in federal giving on Senate candidates JD Vance and Blake Masters
- 2024 — His former employee and political protégé JD Vance becomes the Republican vice-presidential nominee
- 2025 — Vance takes office as vice president, making Thiel's political network newly consequential

**Sources:** <https://www.britannica.com/money/Peter-Thiel> · <https://foundersfund.com/team/peter-thiel/> · <https://investors.palantir.com/board.html> · <https://www.wikidata.org/wiki/Q705525> · <https://www.dia.govt.nz/Citizenship-of-Mr-Peter-Thiel> · <https://www.americamagazine.org/all-things/2014/10/01/faith-technology-qa-peter-thiel/> · <https://www.cato-unbound.org/2009/04/13/peter-thiel/education-libertarian/> · <https://www.investing.com/news/world-news/exclusivepeter-thiel-republican-megadonor-wont-fund-candidates-in-2024--sources-3064715> · <https://www.washingtonpost.com/technology/2024/07/28/jd-vance-peter-thiel-donors-big-tech-trump-vp/> · <https://apnews.com/article/italy-peter-thiel-paypal-pope-vatican-c3a6c7d2daba501caf8152558ac2d743> · <https://www.forbes.com/profile/peter-thiel/>

### Timothy Mellon

*Banking-family heir and transportation businessman who became one of the largest disclosed donors in the 2024 election, principally supporting Donald Trump and Robert F. Kennedy Jr.*

**Born:** 1942-07-22

Timothy Mellon is an heir to the Mellon banking fortune and founded the rail company Guilford Transportation Industries, later Pan Am Systems. He has funded conservative causes for years and emerged as one of the largest donors of the 2024 cycle through major gifts to super PACs supporting Donald Trump and Robert F. Kennedy Jr.

**Notable events**

- 1981 — Founds Guilford Transportation Industries
- 2020 — Becomes a major donor to a pro-Trump super PAC
- 2024 — Ranks among the cycle's largest disclosed individual donors

**Sources:** <https://www.investing.com/news/politics/factboxwho-are-the-megarich-donors-backing-trump-3400286> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Miriam Adelson

*Physician, controlling shareholder of Las Vegas Sands, and one of the Republican Party's largest donors through election groups including Preserve America.*

**Born:** 1945-10-10

Miriam Adelson is a physician and the widow of casino executive Sheldon Adelson. Together they became central funders of Republican candidates, the Republican Jewish Coalition and pro-Israel political causes. After her husband's death, she continued as a major donor and served as the principal financier of Preserve America during the 2024 presidential election.

**Notable events**

- 1991 — Marries Las Vegas Sands founder Sheldon Adelson
- 2018 — Receives the Presidential Medal of Freedom
- 2024 — Leads financing for the pro-Trump Preserve America super PAC

**Sources:** <https://www.investing.com/news/world-news/republican-mega-donor-adelson-to-back-major-protrump-spending-group-3464039> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Richard Uihlein

*Co-founder of the shipping-supplies company Uline and a major financier of Republican candidates and conservative outside groups.*

**Born:** 1945

Richard Uihlein co-founded Uline with his wife, Elizabeth, in 1980. The couple built the company into a large privately held distributor and became among the most prolific funders of Republican candidates, super PACs and conservative organizations. Their giving has supported both national races and state-level political networks.

**Notable events**

- 1980 — Co-founds Uline
- 2010s — Becomes a leading funder of conservative outside groups
- 2024 — Richard and Elizabeth Uihlein rank among the election cycle's largest donor households

**Connections**

- Richard Uihlein → *married-to* → Elizabeth Uihlein

**Sources:** <https://www.washingtonpost.com/elections/interactive/2024/biggest-campaign-donors-election-2024/> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Elizabeth Uihlein

*President and co-founder of Uline and, with Richard Uihlein, a major donor to Republican candidates and conservative political organizations.*

**Born:** 1945

Elizabeth Uihlein co-founded Uline with her husband, Richard, and serves as its president. She participates directly in the couple's extensive political giving and has supported Republican candidates and conservative advocacy groups at the federal and state levels.

**Notable events**

- 1980 — Co-founds Uline
- 2024 — Richard and Elizabeth Uihlein rank among the election cycle's largest donor households

**Connections**

- Richard Uihlein → *married-to* → Elizabeth Uihlein

**Sources:** <https://www.washingtonpost.com/elections/interactive/2024/biggest-campaign-donors-election-2024/> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Ken Griffin

*Founder and chief executive of Citadel and one of the largest Republican donors in recent federal election cycles.*

**Born:** 1968-10-15

Ken Griffin founded the hedge fund Citadel and later the market-making firm Citadel Securities. He has become a leading donor to Republican congressional candidates, party committees and outside groups, while also funding education, public safety, museums and universities. His support has often favored establishment-oriented Republican candidates.

**Notable events**

- 1990 — Founds Citadel
- 2022 — Ranks among the largest individual donors in the midterm cycle
- 2024 — Again ranks among the largest disclosed federal political donors

**Sources:** <https://www.washingtonpost.com/elections/interactive/2024/biggest-campaign-donors-election-2024/> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Jeff Yass

*Co-founder of Susquehanna International Group, major Republican and libertarian donor, and a prominent investor in TikTok parent ByteDance.*

**Born:** 1958

Jeff Yass co-founded the trading firm Susquehanna International Group after working as a professional poker player. He has directed large contributions to Republican candidates, the Club for Growth and school-choice organizations. His investment in ByteDance has also placed him near congressional debates over TikTok.

**Notable events**

- 1987 — Co-founds Susquehanna International Group
- 2024 — Emerges as one of the election cycle's largest Republican donors
- 2024 — Draws scrutiny as Congress debates restrictions affecting TikTok

**Sources:** <https://www.investing.com/news/stock-market-news/republican-hedge-fund-owner-and-tiktok-investor-yass-emerges-as-top-donor-in-us-election-3347498> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Charles Koch

*Chairman of Koch, Inc. and principal builder of a large libertarian and conservative policy, advocacy, academic and electoral network.*

**Born:** 1935-11-01

Charles Koch has led Koch Industries, now Koch, Inc., since 1967. With his late brother David, he funded a durable network of think tanks, university programs, advocacy organizations and election groups organized around limited government, free markets and deregulation. The network now operates largely through Stand Together and Americans for Prosperity.

**Notable events**

- 1967 — Becomes leader of the family business later known as Koch Industries
- 1977 — Helps found the Cato Institute
- 2004 — Helps establish Americans for Prosperity
- 2019 — Consolidates much of the network under the Stand Together name

**Sources:** <https://www.britannica.com/biography/Charles-Koch> · <https://standtogether.org/about-us/charles-koch>

### Paul Singer

*Founder of Elliott Investment Management and a major Republican donor with longstanding influence in conservative policy and pro-Israel organizations.*

**Born:** 1944-08-22

Paul Singer founded Elliott Investment Management in 1977. He has financed Republican candidates and committees, policy organizations including the Manhattan Institute, and pro-Israel advocacy. Singer has also supported same-sex marriage campaigns, making his political giving broader than a single conservative faction.

**Notable events**

- 1977 — Founds Elliott Management
- 2012 — Helps finance Republican efforts to legalize same-sex marriage in New York
- 2020s — Remains a major donor to Republican candidates and outside groups

**Sources:** <https://www.washingtonpost.com/elections/interactive/2024/biggest-campaign-donors-election-2024/> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Stephen Schwarzman

*Co-founder and chief executive of Blackstone and a major Republican donor with influence in business, education and U.S.-China policy circles.*

**Born:** 1947-02-14

Stephen Schwarzman co-founded the private-equity firm Blackstone in 1985. He has been a major donor to Republican candidates and committees and served as chair of a business advisory forum during Donald Trump's first administration. His philanthropy has also funded major university and public-library projects.

**Notable events**

- 1985 — Co-founds Blackstone
- 2016 — Chairs the incoming Trump administration's Strategic and Policy Forum
- 2024 — Supports Donald Trump's return to the presidency

**Sources:** <https://www.britannica.com/biography/Stephen-A-Schwarzman> · <https://www.washingtonpost.com/elections/interactive/2024/biggest-campaign-donors-election-2024/>

### Larry Ellison

*Oracle co-founder and longtime Republican donor whose influence spans technology, national security contracting, media investments and electoral politics.*

**Born:** 1944-08-17

Larry Ellison co-founded Oracle in 1977 and remains its chairman and chief technology officer. He has contributed to Republican candidates and super PACs and has hosted political fundraisers. Oracle's role in government computing and Ellison's investments in media and technology give him influence beyond direct campaign contributions.

**Notable events**

- 1977 — Co-founds Oracle
- 2020 — Hosts a fundraiser for Donald Trump
- 2020s — Continues supporting Republican candidates and political groups

**Sources:** <https://www.britannica.com/biography/Larry-Ellison> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### George Soros

*Investor and founder of the Open Society Foundations, with decades of major giving to Democratic candidates, civil-society organizations and progressive causes.*

**Born:** 1930-08-12

George Soros built a fortune in investment management and established the Open Society Foundations, which fund civil society, human rights and democratic institutions internationally. In U.S. politics he has financed Democratic candidates and outside groups, voting-rights work and criminal-justice reform. His political role is frequently exaggerated by conspiracy theories, but his disclosed giving and institutional network are substantial and public.

**Notable events**

- 1979 — Begins large-scale philanthropy
- 1993 — Establishes the Open Society Foundations network
- 2004 — Becomes a major donor in Democratic opposition to George W. Bush
- 2023 — Alex Soros succeeds him as chair of Open Society Foundations

**Connections**

- George Soros → *family-of* → Alex Soros — father and son

**Sources:** <https://www.opensocietyfoundations.org/george-soros> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Alex Soros

*Chair of the Open Society Foundations and political donor who now leads much of the Soros family's institutional and electoral activity.*

**Born:** 1985-10-27

Alex Soros is the son of investor and philanthropist George Soros. He was elected chair of the Open Society Foundations in 2022 and publicly assumed leadership of the network in 2023. He has met frequently with Democratic officials and directs giving across democracy, rights and progressive political causes.

**Notable events**

- 2012 — Establishes the Alexander Soros Foundation
- 2022 — Elected chair of Open Society Foundations
- 2023 — Publicly succeeds George Soros as leader of the family network

**Connections**

- George Soros → *family-of* → Alex Soros — father and son

**Sources:** <https://www.opensocietyfoundations.org/who-we-are/leadership/alex-soros> · <https://www.opensocietyfoundations.org/newsroom/open-society-foundations-announce-new-leadership>

### Michael Bloomberg

*Bloomberg LP founder, former New York City mayor, presidential candidate, and major Democratic donor focused on gun policy, climate and public health.*

**Born:** 1942-02-14

Michael Bloomberg founded the financial-information company Bloomberg LP and served three terms as mayor of New York City. He has spent heavily on his own campaigns and on Democratic candidates and outside groups. Through Bloomberg Philanthropies and advocacy organizations, he has built national networks around gun regulation, climate policy and public health.

**Notable events**

- 1981 — Founds the company later named Bloomberg LP
- 2002–2013 — Serves as mayor of New York City
- 2020 — Self-finances a presidential primary campaign
- 2020s — Continues major funding of Democratic campaigns, climate work and gun-policy advocacy

**Sources:** <https://www.bloomberg.org/about/mike-bloomberg/> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Reid Hoffman

*LinkedIn co-founder and venture capitalist who is one of the technology industry's most active funders of Democratic candidates and political organizations.*

**Born:** 1967-08-05

Reid Hoffman co-founded LinkedIn and became a partner at Greylock. He has funded Democratic presidential and congressional campaigns, candidate-recruitment groups and organizations working on elections and civic participation. He is also a prominent participant in debates over artificial intelligence and technology regulation.

**Notable events**

- 2002 — Co-founds LinkedIn
- 2016 — Expands large-scale support for Democratic candidates and organizations
- 2024 — Remains a leading technology-sector donor to Democratic efforts

**Sources:** <https://www.forbes.com/sites/leokamin/2024/06/27/here-are-bidens-top-10-biggest-billionaire-donors-bloomberg-reid-hoffman/> · <https://apnews.com/article/7c6b78b6a8ded9ad253be9ef491e0284>

### Dustin Moskovitz

*Facebook and Asana co-founder whose political giving and Open Philanthropy funding make him a major Democratic and policy donor.*

**Born:** 1984-05-22

Dustin Moskovitz co-founded Facebook and later Asana. With Cari Tuna, he established Good Ventures, the principal funder of Open Philanthropy. He has also made large contributions to Democratic candidates and outside groups, while his philanthropy focuses on global health, biosecurity, science and long-term risks.

**Notable events**

- 2004 — Co-founds Facebook
- 2008 — Co-founds Asana
- 2011 — Establishes Good Ventures with Cari Tuna
- 2024 — Ranks among the largest disclosed Democratic donors

**Sources:** <https://www.forbes.com/sites/leokamin/2024/06/27/here-are-bidens-top-10-biggest-billionaire-donors-bloomberg-reid-hoffman/> · <https://www.openphilanthropy.org/about-us/our-story/>

### Laurene Powell Jobs

*Founder of Emerson Collective, using philanthropy, investment and media ownership to influence immigration, education, climate and civic policy.*

**Born:** 1963-11-06

Laurene Powell Jobs founded Emerson Collective, a hybrid philanthropy and investment organization. Its work spans immigration reform, education, climate, journalism and civic engagement. She is also the owner of The Atlantic, giving her a significant role in national media alongside her political and philanthropic giving.

**Notable events**

- 2004 — Founds Emerson Collective
- 2017 — Acquires a majority stake in The Atlantic
- 2020s — Expands investment and grantmaking across immigration, education, climate and journalism

**Sources:** <https://www.emersoncollective.com/about> · <https://www.theatlantic.com/press-releases/archive/2017/07/emerson-collective-acquires-majority-ownership-of-the-atlantic/535132/>

### Pierre Omidyar

*eBay founder whose Democracy Fund, Omidyar Network and media investments support election administration, journalism and civic institutions.*

**Born:** 1967-06-21

Pierre Omidyar founded eBay and later built a network of philanthropic and investment organizations. Democracy Fund works on election administration, democratic institutions and journalism, while First Look Media launched The Intercept. His influence is exercised more through institutions and grants than candidate-centered giving alone.

**Notable events**

- 1995 — Founds eBay
- 2004 — Establishes Omidyar Network
- 2011 — Establishes Democracy Fund
- 2013 — Creates First Look Media

**Sources:** <https://democracyfund.org/who-we-are/> · <https://omidyargroup.com/>

### Donald Sussman

*Founder of Paloma Partners and a longstanding major donor to Democratic candidates, party committees and progressive outside groups.*

**Born:** 1946-06-08

Donald Sussman founded the investment firm Paloma Partners. For multiple election cycles he has ranked among the Democratic Party's largest individual donors, supporting presidential and congressional campaigns, party committees and super PACs. He has also funded policy and civil-society organizations.

**Notable events**

- 1981 — Founds Paloma Partners
- 2016 — Becomes one of the largest individual donors supporting Democratic federal candidates
- 2020s — Continues major giving to Democratic committees and outside groups

**Sources:** <https://www.opensecrets.org/elections-overview/biggest-donors> · <https://www.washingtonpost.com/elections/interactive/2024/biggest-campaign-donors-election-2024/>

### Marc Andreessen

*Venture capitalist and Andreessen Horowitz co-founder whose money and public advocacy shape technology, cryptocurrency, defense and Republican policy debates.*

**Born:** 1971-07-09

Marc Andreessen co-created the Mosaic web browser and co-founded Netscape before establishing Andreessen Horowitz with Ben Horowitz. The firm has become a major investor and policy advocate in cryptocurrency, artificial intelligence and defense technology. Andreessen endorsed Donald Trump in 2024 and became a prominent voice in the technology industry's move toward Republican politics.

**Notable events**

- 1993 — Helps create the Mosaic web browser
- 2009 — Co-founds Andreessen Horowitz
- 2023 — Publishes The Techno-Optimist Manifesto
- 2024 — Endorses Donald Trump

**Sources:** <https://a16z.com/the-techno-optimist-manifesto/> · <https://www.theatlantic.com/newsletters/archive/2024/08/the-tech-trump-alliance/679656/>

### David Sacks

*Venture capitalist, former PayPal executive, political fundraiser, and White House special adviser for artificial intelligence and cryptocurrency.*

**Born:** 1972-05-25

David Sacks was PayPal's chief operating officer, founded Yammer and later founded Craft Ventures. He became an active Republican donor and fundraiser, hosting a major event for Donald Trump in 2024. In 2025 he entered the White House as a special government employee advising on artificial intelligence and cryptocurrency policy.

**Notable events**

- 2008 — Founds Yammer
- 2017 — Co-founds Craft Ventures
- 2024 — Hosts a major fundraiser for Donald Trump
- 2025 — Begins serving as White House special adviser for AI and cryptocurrency

**Sources:** <https://www.whitehouse.gov/wp-content/uploads/2025/06/David-Sacks.pdf> · <https://www.govinfo.gov/content/pkg/DCPD-202500166/pdf/DCPD-202500166.pdf>

### Harlan Crow

*Texas real-estate executive and Republican donor whose undisclosed gifts and financial ties to Justice Clarence Thomas drew national scrutiny.*

**Born:** 1949

Harlan Crow is the former chairman and chief executive of Crow Holdings, a Dallas real-estate company founded by his father. He has donated to Republican candidates and conservative organizations and served on boards of policy institutions. Reporting beginning in 2023 documented extensive gifts, travel and financial transactions involving Supreme Court Justice Clarence Thomas.

**Notable events**

- 1988 — Takes leadership of the family real-estate business
- 2023 — ProPublica reports undisclosed luxury travel and property transactions involving Justice Clarence Thomas

**Sources:** <https://www.propublica.org/article/clarence-thomas-scotus-undisclosed-luxury-travel-gifts-crow> · <https://www.propublica.org/article/clarence-thomas-harlan-crow-real-estate-scotus>

### Barre Seid

*Industrialist whose transfer of a company worth roughly $1.6 billion created one of the largest known political donations, funding the Marble Freedom Trust.*

**Born:** 1932

Barre Seid built his wealth through electronics manufacturer Tripp Lite. In 2020 he transferred ownership of the company to the Marble Freedom Trust, a nonprofit led by conservative legal activist Leonard Leo; the subsequent sale generated approximately $1.6 billion for the trust. The transaction created a major long-term funding source for conservative legal and political organizations.

**Notable events**

- 2020 — Transfers Tripp Lite ownership to Marble Freedom Trust
- 2021 — Sale of Tripp Lite produces roughly $1.6 billion for the trust
- 2022 — The transaction becomes public through reporting and tax records

**Sources:** <https://www.propublica.org/article/dark-money-leonard-leo-barre-seid> · <https://www.nytimes.com/2022/08/22/us/politics/republican-dark-money.html>

### John Arnold

*Former energy trader and co-founder of Arnold Ventures, a major policy philanthropy working on criminal justice, health care, public finance and evidence-based government.*

**Born:** 1974

John Arnold made his fortune as an energy trader at Enron and through the hedge fund Centaurus Advisors. With Laura Arnold he created Arnold Ventures, which funds research, advocacy and ballot campaigns across criminal justice, health care, public finance and government effectiveness. Their giving is structured around policy outcomes rather than a single party identity.

**Notable events**

- 2002 — Founds Centaurus Advisors
- 2010 — Begins full-time philanthropy with Laura Arnold
- 2019 — The Laura and John Arnold Foundation becomes Arnold Ventures

**Connections**

- John Arnold → *married-to* → Laura Arnold

**Sources:** <https://www.arnoldventures.org/about> · <https://www.arnoldventures.org/stories/our-founders>

### Laura Arnold

*Attorney and co-founder of Arnold Ventures, directing major policy funding in criminal justice, health care, public finance and government effectiveness.*


Laura Arnold is an attorney and former energy-company executive who co-founded Arnold Ventures with her husband, John Arnold. She helps direct its research, grantmaking and advocacy across criminal justice, health care, public finance and evidence-based policy. The organization supports work associated with both major parties and with nonpartisan institutions.

**Notable events**

- 2010 — Begins full-time philanthropy with John Arnold
- 2019 — The Laura and John Arnold Foundation becomes Arnold Ventures

**Connections**

- John Arnold → *married-to* → Laura Arnold

**Sources:** <https://www.arnoldventures.org/about> · <https://www.arnoldventures.org/stories/our-founders>

### Robert Mercer

*Computer scientist and former Renaissance Technologies executive who financed conservative campaigns, Breitbart and data firm Cambridge Analytica.*

**Born:** 1946-07-11

Robert Mercer made his fortune at the hedge fund Renaissance Technologies. With his daughter Rebekah, he became a major funder of conservative candidates and institutions, including Breitbart and Cambridge Analytica. The Mercer network played a prominent role in Republican politics during the 2016 presidential election.

**Notable events**

- 1993 — Joins Renaissance Technologies
- 2011 — Begins a period of major giving to conservative super PACs
- 2016 — Mercer-backed organizations support Donald Trump's presidential campaign
- 2017 — Steps down from Renaissance Technologies

**Connections**

- Robert Mercer → *family-of* → Rebekah Mercer — father and daughter

**Sources:** <https://www.opensecrets.org/elections-overview/biggest-donors> · <https://www.newyorker.com/magazine/2017/03/27/the-reclusive-hedge-fund-tycoon-behind-the-trump-presidency>

### Rebekah Mercer

*Conservative donor and foundation director who helped steer Mercer-family funding to campaigns, Breitbart and political organizations.*

**Born:** 1973

Rebekah Mercer directs the Mercer Family Foundation and became an important organizer and donor in conservative politics during the 2016 election. She served on the executive committee of Donald Trump's transition team and has backed candidates, think tanks and media organizations including Breitbart.

**Notable events**

- 2012 — Becomes active in directing Mercer-family political giving
- 2016 — Supports Donald Trump's campaign and joins the presidential transition executive committee

**Connections**

- Robert Mercer → *family-of* → Rebekah Mercer — father and daughter

**Sources:** <https://www.newyorker.com/magazine/2017/03/27/the-reclusive-hedge-fund-tycoon-behind-the-trump-presidency> · <https://www.opensecrets.org/elections-overview/biggest-donors>

### Tom Steyer

*Former hedge-fund manager, climate activist, Democratic megadonor and 2020 presidential candidate.*

**Born:** 1957-06-27

Tom Steyer founded the investment firm Farallon Capital and later left finance for politics and philanthropy. Through NextGen America he funded climate advocacy, voter mobilization and Democratic candidates. He ran for the Democratic presidential nomination in 2020 and has continued financing climate and clean-energy work.

**Notable events**

- 1986 — Founds Farallon Capital
- 2013 — Establishes NextGen America
- 2019–2020 — Campaigns for the Democratic presidential nomination

**Sources:** <https://www.britannica.com/biography/Tom-Steyer> · <https://www.nextgenamerica.org/about/>

### Eric Schmidt

*Former Google chief executive and major technology-policy philanthropist with influence in artificial intelligence, national security and Democratic politics.*

**Born:** 1955-04-27

Eric Schmidt led Google from 2001 to 2011 and later chaired its parent company. He has advised the federal government on defense and artificial intelligence, funded policy organizations and scientific research, and donated largely to Democratic candidates. His network connects Silicon Valley capital with national-security and technology policy.

**Notable events**

- 2001–2011 — Serves as Google chief executive
- 2018–2021 — Chairs the National Security Commission on Artificial Intelligence
- 2020s — Funds AI, science and national-security policy initiatives

**Sources:** <https://www.schmidtfutures.com/our-story/> · <https://apnews.com/article/7c6b78b6a8ded9ad253be9ef491e0284>

### Vinod Khosla

*Sun Microsystems co-founder and venture capitalist active in Democratic fundraising and policy debates over climate, health and artificial intelligence.*

**Born:** 1955-01-28

Vinod Khosla co-founded Sun Microsystems and later established Khosla Ventures. He has supported Democratic candidates and used his investment platform to advocate for clean technology, biotechnology and aggressive development of artificial intelligence. He is a frequent participant in political fundraising and technology-policy discussions.

**Notable events**

- 1982 — Co-founds Sun Microsystems
- 2004 — Founds Khosla Ventures
- 2024 — Campaigns and raises money for the Democratic presidential ticket

**Sources:** <https://www.britannica.com/biography/Vinod-Khosla> · <https://apnews.com/article/7c6b78b6a8ded9ad253be9ef491e0284>

### Joe Lonsdale

*Palantir and 8VC co-founder who funds Republican candidates and organizations connecting Silicon Valley, defense technology and conservative policy.*

**Born:** 1982-09-12

Joe Lonsdale co-founded Palantir and the venture firm 8VC. He has donated to Republican candidates, supported technology-focused conservative networks and helped organize donors around defense, industrial and government-reform priorities. His investments and political activity place him within the broader Peter Thiel-aligned technology network.

**Notable events**

- 2003 — Co-founds Palantir
- 2015 — Founds venture firm 8VC
- 2024 — Helps organize and fund technology-industry support for Republican candidates

**Sources:** <https://www.washingtonpost.com/technology/2024/07/28/jd-vance-peter-thiel-donors-big-tech-trump-vp/> · <https://www.8vc.com/team/joe-lonsdale>

### Palmer Luckey

*Founder of Oculus and Anduril Industries, Republican donor, and influential advocate for defense technology and military procurement reform.*

**Born:** 1992-09-19

Palmer Luckey founded the virtual-reality company Oculus and sold it to Facebook before founding defense contractor Anduril Industries. He is a major Republican donor and an outspoken advocate for expanding the role of venture-backed technology companies in national defense. Anduril's growth has made him an increasingly important figure in military procurement debates.

**Notable events**

- 2012 — Founds Oculus VR
- 2014 — Sells Oculus to Facebook
- 2017 — Founds Anduril Industries
- 2020s — Becomes a prominent Republican technology donor and defense-policy advocate

**Sources:** <https://www.anduril.com/leadership/palmer-luckey/> · <https://www.washingtonpost.com/technology/2024/07/28/jd-vance-peter-thiel-donors-big-tech-trump-vp/>

## Organizations

### American Renaissance

*White nationalist magazine, website and annual conference founded by Jared Taylor in 1990; it calls its outlook "race realism."*

**Also known as:** AmRen, New Century Foundation · **Founded:** 1990

American Renaissance (AmRen) began as a monthly print newsletter in November 1990, published by Jared Taylor's New Century Foundation. It argues that races differ in intelligence and temperament and that Whites should organize around racial identity. It has generally tried to present itself as more respectable than the Klan and neo-Nazi wings of the movement.

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

*Texas-based White nationalist group founded by Thomas Rousseau in August 2017, known for masked, uniformed flash marches and mass propaganda drops.*

**Founded:** 2017

Patriot Front was formed in August 2017, in the days after the Unite the Right rally in Charlottesville. Thomas Rousseau, who had led Vanguard America's contingent there, rebranded his faction of that group. The Discord message announcing the change said the focus and goals would stay the same. The group wraps White nationalism in Revolutionary-era American iconography: fasces logos, "Reclaim America" slogans and khaki-and-navy uniforms with face coverings.

Its signature tactics are unannounced "flash marches" in city centers (Philadelphia, Boston, Washington), tightly choreographed and filmed for propaganda, plus mass stickering and flyering. Since 2019 the ADL has attributed the majority of White supremacist propaganda incidents in the U.S. to Patriot Front.

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

VDARE was founded in 1999 by Peter Brimelow and named for Virginia Dare, the first English child born in the Americas (1587). It was the main web home for writers such as Steve Sailer and John Derbyshire after mainstream outlets dropped them, and it blurred the line between immigration restrictionism and White nationalism.

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
