import styles from "./landing.module.css";

export function CloudDialogue({ children, speaker, changeKey }: {
  children: React.ReactNode;
  speaker: "seated" | "standing";
  changeKey: string | number;
}) {
  return (
    <div className={`${styles.cloud} ${speaker === "standing" ? styles.standingCloud : ""}`}>
      <svg viewBox="0 0 1000 130" preserveAspectRatio="none" aria-hidden="true">
        <path d={speaker === "standing"
          ? "M55 32 Q90 0 170 25 Q210 8 255 24 Q310 4 365 25 Q430 0 490 25 Q540 8 590 24 Q650 4 705 25 Q765 0 820 25 Q870 8 920 29 Q953 17 975 2 Q978 35 956 52 Q985 85 947 104 Q900 133 840 111 Q780 133 720 111 Q650 133 590 111 Q530 133 470 111 Q410 133 350 111 Q290 133 230 111 Q170 133 110 111 Q30 130 15 89 Q0 52 55 32 Z"
          : "M35 29 Q80 -2 170 21 Q240 -5 310 21 Q380 -5 450 21 Q535 -6 625 21 Q710 -7 775 21 Q817 40 813 65 Q866 107 954 100 Q980 99 992 116 Q918 99 856 113 Q821 116 795 100 Q740 135 680 111 Q625 134 565 111 Q505 135 445 111 Q380 135 320 111 Q245 136 170 111 Q95 135 40 108 Q-10 80 35 29 Z"} />
      </svg>
      <p key={changeKey} aria-live="polite" aria-atomic="true">{children}</p>
    </div>
  );
}
