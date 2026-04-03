export function GuidePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-mono font-bold mb-1">Guide</h1>
      <p className="text-sm text-slate-500 font-mono mb-6">How to use the simulator and what everything means.</p>

      <GuideSection title="What This Tool Is">
        <p>
          The Craps Simulator runs mathematically exact craps strategy simulations and visualizes
          the results. It is not a game — there are no dice to click, no chips to drag. It is an
          analytical instrument for understanding how a strategy <em>behaves</em> over time: how it
          wins, how it loses, how it manages risk, and how it compares against alternatives.
        </p>
        <p>
          The simulator knows craps rules precisely: pass line, come bets, place bets, odds,
          point resolution, seven-outs — all resolved correctly at every roll. The house edge is
          what it is. The simulator does not sugarcoat it.
        </p>
      </GuideSection>

      <GuideSection title="Seeds: Pinning the Dice">
        <p>
          A <strong>seed</strong> is a number that controls the dice sequence. Two runs with the
          same seed produce identical dice — every roll, in the same order. A run with no seed
          gets a random dice sequence every time.
        </p>
        <p>This matters because it lets you answer questions that would otherwise be impossible:</p>
        <ul>
          <li>
            <em>Does CATS outperform Three Point Molly, or did CATS just get luckier dice?</em> —
            Run both on the same seed. Same dice, different strategies. The comparison is fair.
          </li>
          <li>
            <em>How does CATS behave on a bad table?</em> — Find a seed with a rough session,
            pin it, explore it from every angle.
          </li>
          <li>
            <em>Did my understanding of the strategy change what I see?</em> — Pin a seed, change
            strategy. The dice are controlled, so any difference is real.
          </li>
        </ul>
        <p>
          When you run a simulation without entering a seed, the simulator generates one and{' '}
          <strong>writes it to the URL</strong>. This means every completed run is reproducible —
          you can copy the URL, share it, or return to it later and see exactly the same result.
        </p>
        <p>To get a fresh random run, clear the seed field and click Run again.</p>
      </GuideSection>

      <GuideSection title="The Pages">
        <SubSection title="Session — What Happened">
          <p>
            The Session page shows a single simulation run in full detail. It is the place to
            understand <em>one specific session</em> — one strategy, one set of dice, from roll 1
            to roll N.
          </p>
          <SubSubSection title="Shooter Heat">
            <p>
              A compact color strip sits directly above the session chart. It shows dice heat for
              each stretch of the session using a phantom pass-line rubric: green means shooters
              were making points, red means they were sevening out, gray means choppy play with
              no clear signal. Read this strip before diving into the chart — it tells you at a
              glance where the dice were working and where they weren't.
            </p>
          </SubSubSection>
          <SubSubSection title="Summary Panel">
            <p>
              The headline numbers: net change, peak bankroll, trough, max drawdown, win/loss
              roll counts, average table load.
            </p>
          </SubSubSection>
          <SubSubSection title="Session Chart">
            <p>
              Shows bankroll and table load over time. The bankroll line tells the session story.
              The table load line is a proxy for strategy intensity. Seven-outs are marked in red;
              points made in green. For CATS, stage color bands show which phase was active at
              each point in the session.
            </p>
          </SubSubSection>
          <SubSubSection title="Stage Breakdown Table">
            <p>
              Lists every stage visit as a row: which stage, which rolls, how long, what it cost
              or earned. This table reveals patterns the chart cannot — for example, that Little
              Molly is almost always a 1–2 roll tollbooth rather than a sustained phase.
            </p>
          </SubSubSection>
          <SubSubSection title="Stage Overlay Charts">
            <p>
              Takes each stage and overlays all visits on a common timeline starting at zero. A
              tight cluster means the stage behaves consistently. A wide fan means high variance
              between visits.
            </p>
          </SubSubSection>
          <SubSubSection title="Trend Indicators">
            <p>
              Three momentum signals: a rolling 24-roll P&amp;L line, proximity to CATS's step-up
              and step-down thresholds, and the consecutive seven-out counter that drives CATS's
              retreat rules.
            </p>
          </SubSubSection>
          <p className="text-xs font-mono text-gray-400 mt-2">
            URL: <code>/session?strategy=CATS&amp;rolls=500&amp;bankroll=300&amp;seed=7</code>
          </p>
        </SubSection>

        <SubSection title="Session Compare — Same Dice, Different Strategies">
          <p>
            Runs two strategies on <strong>identical dice</strong> and shows the results side by
            side. This is the only fair way to compare strategies — holding luck constant so that
            any difference in outcome is purely a function of betting decisions.
          </p>
          <p>
            The head-to-head chart shows both bankroll lines on the same axes. The net delta —
            how much better or worse one strategy did — is shown prominently. Dice verification
            confirms both strategies saw identical dice.
          </p>
          <p className="text-xs font-mono text-gray-400 mt-2">
            URL: <code>/session-compare?strategies=CATS,ThreePointMolly3X&amp;rolls=500&amp;bankroll=300&amp;seed=7</code>
          </p>
        </SubSection>

        <SubSection title="Distribution — What Typically Happens">
          <p>
            Runs the same strategy hundreds of times across different dice sequences and shows the{' '}
            <em>range of outcomes</em>. It answers the questions a single session cannot: what does
            a typical session look like? How often does this strategy end profitable? When does
            ruin typically happen?
          </p>
          <table className="text-xs font-mono border border-gray-200 rounded my-3">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                <th className="px-3 py-2 font-medium">Preset</th>
                <th className="px-3 py-2 font-medium">Seeds</th>
                <th className="px-3 py-2 font-medium">Best for</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">Quick</td>
                <td className="px-3 py-2">200</td>
                <td className="px-3 py-2 text-gray-600">Fast exploration, rough shape</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">Standard</td>
                <td className="px-3 py-2">500</td>
                <td className="px-3 py-2 text-gray-600">Reliable P10/P50/P90 estimates</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Deep</td>
                <td className="px-3 py-2">1000</td>
                <td className="px-3 py-2 text-gray-600">Stable tail behavior</td>
              </tr>
            </tbody>
          </table>
          <p>
            Results stream in progressively as seeds complete — you are watching statistical
            convergence happen in real time. Load a pre-computed <code>.distribution.json</code>{' '}
            file to add P95/P99 tail bands.
          </p>
          <p className="text-xs font-mono text-gray-400 mt-2">
            URL: <code>/distribution?strategy=CATS&amp;rolls=500&amp;bankroll=300&amp;seeds=500</code>
          </p>
        </SubSection>

        <SubSection title="Distribution Compare — How Strategies Differ">
          <p>
            Runs two strategies across the same set of dice sequences and compares their
            distributional profiles. Where Session Compare asks "who won this session?",
            Distribution Compare asks "which strategy has the better variance structure?"
          </p>
          <p>
            One strategy is the <strong>baseline</strong> (solid lines, shaded band), the other
            is the <strong>test</strong> (dashed lines, no fill). The Swap button exchanges the
            two roles instantly. The Outcome Delta table shows both strategies' stats and the
            delta — green = test is better, red = baseline is better.
          </p>
          <p className="text-xs font-mono text-gray-400 mt-2">
            URL: <code>/distribution-compare?strategy=CATS&amp;test=ThreePointMolly3X&amp;rolls=500&amp;bankroll=300&amp;seeds=500</code>
          </p>
        </SubSection>

        <SubSection title="Strategies — What Each Strategy Does">
          <p>
            A reference page describing each strategy available in the simulator. Read this before
            running a strategy you haven't used before. No simulation runs here — it is a
            documentation page. Each entry covers: what bets are placed, how the strategy escalates
            or adjusts, and the dominant house edge.
          </p>
          <p className="text-xs font-mono text-gray-400 mt-2">
            URL: <code>/strategies</code>
          </p>
        </SubSection>
      </GuideSection>

      <GuideSection title="Navigation and URLs">
        <p>
          Every analytical state in the simulator is a URL. This is intentional.
        </p>
        <p>
          A URL like <code className="text-xs font-mono bg-gray-100 px-1 rounded">/session?strategy=CATS&amp;rolls=500&amp;bankroll=300&amp;seed=7</code>{' '}
          is a complete description of a simulation. You can bookmark it, share it, or return to
          it a week later and see exactly the same result.
        </p>
        <p>
          <strong>Moving between pages preserves your configuration.</strong> If you are looking
          at a CATS Distribution analysis and navigate to Session Compare, the sidebar still shows
          CATS — you are continuing the same analytical thread, not starting over.
        </p>
      </GuideSection>

      <GuideSection title="A Typical Analytical Session">
        <ol>
          <li>
            <strong>Start on Session.</strong> Pick CATS, 500 rolls, $300 bankroll. Run a few
            random seeds to get a feel for how sessions look. Read the Shooter Heat strip first.
            Find an interesting seed.
          </li>
          <li>
            <strong>Pin the seed.</strong> The URL now contains the seed. Bookmark it. This is
            your reference session.
          </li>
          <li>
            <strong>Explore it on Session.</strong> Read the Stage Breakdown table. Look at the
            Overlay charts. When did the Threshold Proximity signal approach the step-down line?
          </li>
          <li>
            <strong>Go to Distribution.</strong> Run Standard (500 seeds) to understand the
            strategy's typical behavior. Is the reference session a typical outcome or an outlier?
          </li>
          <li>
            <strong>Go to Session Compare.</strong> Use the pinned seed. Run CATS against Three
            Point Molly 3X on the same dice. Did CATS outperform because of its structure, or
            despite it?
          </li>
          <li>
            <strong>Go to Distribution Compare.</strong> Run both strategies across 500 seeds.
            Look at the Outcome Delta table. Hit Swap to see the table from the other direction.
          </li>
          <li>
            <strong>Change strategy in the sidebar.</strong> Switch to Place 6 &amp; 8 or another
            variant. The current page re-runs with the new configuration.
          </li>
        </ol>
      </GuideSection>

      <GuideSection title="A Note on House Edge">
        <p>
          The simulator does not offer winning strategies. The house edge is real and does not
          negotiate. What the simulator offers is <em>clarity about variance</em> — understanding
          when a strategy's structure helps you manage a losing game in a way that fits your style
          and session goals.
        </p>
        <p>
          A strategy that has a 35% chance of ending a session profitable is not a winning
          strategy. It is a strategy with a particular variance profile that happens to suit some
          players' preferences. The Distribution page makes this profile explicit rather than
          leaving it to imagination or folklore.
        </p>
        <p>The goal is informed play, not magical thinking.</p>
      </GuideSection>
    </div>
  );
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-mono font-bold text-gray-900 mb-3 pb-1 border-b border-gray-200">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-mono font-semibold text-gray-800 mb-2">{title}</h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function SubSubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 pl-3 border-l-2 border-gray-200">
      <h4 className="text-xs font-mono font-semibold text-gray-600 uppercase tracking-wide mb-1">{title}</h4>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}
