import QrCode2Icon from "@mui/icons-material/QrCode2";
import { IconButton } from "@mui/material";
import { getRandomColor } from "@/utils/material3";
import styles from "./styles.module.css";

interface PageHeaderProps {
  handleOpenQr?: () => void;
}

export function PageHeader({ handleOpenQr }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <h3>memento</h3>

      {handleOpenQr && (
        <IconButton
          className={styles.qrCode}
          style={{ color: getRandomColor(700) }}
          size="small"
          onClick={handleOpenQr}
        >
          <QrCode2Icon sx={{ fontSize: 22 }} />
        </IconButton>
      )}
    </header>
  );
}
