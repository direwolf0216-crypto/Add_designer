import type { TransactionListGroup } from "@/lib/transactions/grouping";
import { TransactionRow } from "./TransactionRow";

interface TransactionGroupRowProps {
  group: TransactionListGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

/** A bulk-entry group header; when expanded, its lines are listed underneath as child rows. */
export function TransactionGroupRow({ group, isExpanded, onToggle, onOpenDetails, onEdit, onDelete, canEdit, canDelete }: TransactionGroupRowProps) {
  return (
    <TransactionRow
      tx={group}
      isExpanded={isExpanded}
      onToggle={onToggle}
      onOpenDetails={() => onOpenDetails(group.id)}
      onEdit={() => onEdit(group.id)}
      onDelete={() => onDelete(group.id)}
      canEdit={canEdit}
      canDelete={canDelete}
    >
      {isExpanded && (
        <div className="animate-slide-down">
          {group.children.map((childTx) => (
            <TransactionRow
              key={childTx.id}
              tx={childTx}
              isChild
              onOpenDetails={() => onOpenDetails(childTx.id)}
              onEdit={() => onEdit(childTx.id)}
              onDelete={() => onDelete(childTx.id)}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </TransactionRow>
  );
}
