"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import NavIcon, { type NavIconName } from "@/components/NavIcon";
import { isCollapsed, NARROW, NAV, toggleCollapsed } from "@/lib/collapse";

export interface NavItem {
  href: string;
  label: string;
  /** Das Zeichen trägt den Eintrag, wenn die Leiste eingeklappt ist. */
  icon: NavIconName;
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function Nav({
  seasonName,
  seasonRange,
  seasonShort,
  groups,
}: {
  seasonName: string;
  seasonRange: string;
  seasonShort: string;
  groups: NavGroup[];
}) {
  const pathname = usePathname();

  /*
    Ob die Leiste am breiten Fenster schmal ist, entscheidet allein das Attribut
    am Dokument — beide Beschriftungen stehen immer im Markup, das Stylesheet
    zeigt die passende. So gibt es beim Laden weder Sprung noch Abweichung
    zwischen Server und Browser; der Zustand hier trägt nur die Beschriftung des
    Umschalters und zieht deshalb erst nach dem Anhängen nach.
  */
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(isCollapsed(NAV));
  }, []);

  /*
    Am Telefon steht die Leiste nicht am Rand, sondern kommt auf Knopfdruck
    davor. Das ist nichts, was man sich merkt: es gilt für diesen einen Griff
    und ist danach wieder fort, deshalb liegt es hier und nicht im Speicher.
  */
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // Was sich vor die Seite legt, muss auch mit der Fluchttaste wieder weg.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = useCallback(() => {
    if (matchMedia(NARROW).matches) setOpen((was) => !was);
    else setCollapsed(toggleCollapsed(NAV));
  }, []);

  /*
    Ist die Leiste höher als ihr Platz, muss der Eintrag der offenen Seite
    sichtbar sein — sonst steht man auf den Einstellungen und sieht als Erstes
    die Übersicht markiert wirken.
  */
  const bar = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = bar.current;
    const current = el?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!el || !current || el.scrollHeight <= el.clientHeight) return;
    el.scrollTo({
      top: current.offsetTop - (el.clientHeight - current.offsetHeight) / 2,
      behavior: "instant",
    });
  }, [pathname]);

  // Der statische Export legt jede Seite als Ordner ab, die Adressen enden also
  // auf einem Schrägstrich. Beide Seiten werden gleich zugeschnitten — sonst
  // bliebe der Eintrag bei einem vergessenen Schrägstrich stumm.
  const isCurrent = (href: string) => {
    const here = trimSlash(pathname);
    const target = trimSlash(href);
    return target === "" ? here === "" : here === target || here.startsWith(`${target}/`);
  };

  return (
    <>
      {/*
        Am Telefon der einzige Rest der Leiste, solange sie fort ist. Er steht
        über der Seite und nicht in ihr: der Kopf jeder Seite rückt an ihm
        vorbei, damit er nichts verdeckt.
      */}
      <button
        aria-controls="nav"
        aria-expanded={open}
        aria-label="Navigation zeigen"
        className="nav-hamburger no-print"
        onClick={toggle}
        type="button"
      >
        <NavIcon name="menu" />
      </button>

      {/*
        Der Rest des Schirms, während das Blatt davor liegt: abgedunkelt und
        ansprechbar. Ein Knopf und kein bloßer Schleier, damit auch die Tastatur
        wieder herauskommt.
      */}
      <button
        aria-label="Navigation schließen"
        className="nav-scrim"
        hidden={!open}
        onClick={close}
        type="button"
      />

      <nav className="nav no-print" data-open={open ? "" : undefined} id="nav" ref={bar}>
        <div className="nav-season">
          <div className="nav-season-text">
            <strong>{seasonName}</strong>
            <span className="num">{seasonRange}</span>
          </div>
          <span className="nav-season-short num">{seasonShort}</span>
          <button
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Navigation ausklappen" : "Navigation einklappen"}
            className="nav-toggle"
            onClick={toggle}
            type="button"
          >
            <span aria-hidden>‹</span>
          </button>
        </div>

        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent(item.href) ? "page" : undefined}
                onClick={close}
                title={item.label}
              >
                <NavIcon name={item.icon} />
                <span className="nav-label">{item.label}</span>
                {item.badge ? <small>{item.badge}</small> : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
