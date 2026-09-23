// Ghost brand mark sitting BEHIND every chart.
//
// WHY: the charts get screenshotted and reshared with no indication they're ours — one post with
// 73 likes and 15 reposts carried zero attribution. Footers and corner marks don't survive a crop
// (the screenshot that prompted this kept only the stat band, donut and legend), so the mark is
// large and CENTRED: you can't crop it out without cropping the data.
//
// The domain is locked ON TOP of the sphere rather than beneath it. Tested: a crop tight to the
// donut caught the logo but lost a wordmark placed below, which would brand without attributing.
// Stacked, the two always travel together.
//
// Deliberately LOW CONTRAST — these charts get reshared *because* they look clean, so a loud
// watermark would trade reach for credit. Behind the data (z-index 0), never intercepts pointer
// events, hidden from screen readers. The asset is the rainbow-sphere project logo with its black
// background converted to alpha, so it works on BOTH themes (a blend-mode trick would be dark-only).
export default function ChartWatermark({ size = 460, label = true }) {
  return (
    <div className="chartwm" aria-hidden="true">
      <div className="chartwm-lockup" style={{ width: size }}>
        <img src="/watermark-rainbow.png" alt="" draggable="false" />
        {label && <span className="chartwm-label">spx6900rainbow.xyz</span>}
      </div>
    </div>
  );
}
