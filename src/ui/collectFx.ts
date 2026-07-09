import type { MineralType } from '../state/types';

const GEM_COLORS: Record<MineralType, string> = {
  quartz: '#f8fafc',
  copper: '#f59e0b',
  lithium: '#fb7185',
  cobalt: '#60a5fa',
  rareEarths: '#a78bfa'
};

const MAX_CONCURRENT_GEMS = 14;

/**
 * Flies a small gem from a viewport position into the pipeline HUD's
 * matching mineral cell, then flashes the cell on arrival. Purely
 * cosmetic: skipped entirely under prefers-reduced-motion, when the
 * target cell is missing, or when too many gems are already in flight.
 */
export function flyGemToHud(fromX: number, fromY: number, mineral: MineralType): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const target = document.querySelector<HTMLElement>(`.pipeline-hud [data-resource="${mineral}"]`);
  if (!target || document.querySelectorAll('.collect-gem').length >= MAX_CONCURRENT_GEMS) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  if (targetRect.width === 0) {
    return;
  }

  const gem = document.createElement('span');
  gem.className = 'collect-gem';
  gem.setAttribute('aria-hidden', 'true');
  gem.innerHTML = gemSvg(GEM_COLORS[mineral]);
  gem.style.left = `${fromX}px`;
  gem.style.top = `${fromY}px`;
  document.body.append(gem);

  const deltaX = targetRect.left + targetRect.width / 2 - fromX;
  const deltaY = targetRect.top + targetRect.height / 2 - fromY;

  const animation = gem.animate(
    [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0 },
      { transform: `translate(calc(-50% + ${deltaX * 0.4}px), calc(-50% + ${deltaY * 0.28}px)) scale(1.15)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(0.4)`, opacity: 0.85, offset: 1 }
    ],
    { duration: 620, easing: 'cubic-bezier(0.3, 0, 0.4, 1)' }
  );

  animation.onfinish = () => {
    gem.remove();
    pulseCell(mineral);
  };
  animation.oncancel = () => gem.remove();
}

function pulseCell(mineral: MineralType): void {
  const cell = document.querySelector<HTMLElement>(`.pipeline-hud [data-resource="${mineral}"]`);
  if (!cell) {
    return;
  }

  cell.classList.remove('resource-cell-receive');
  // Restart the CSS animation even if the class was already present.
  void cell.offsetWidth;
  cell.classList.add('resource-cell-receive');
}

function gemSvg(color: string): string {
  return `<svg viewBox="0 0 32 32" width="18" height="18"><polygon points="16 2 29 11 24 29 8 29 3 11" fill="${color}" stroke="#17202a" stroke-width="2"/><polyline points="9 11 16 5 23 11" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="2"/></svg>`;
}
