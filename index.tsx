import React, { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';

// --- 데이터 구조 정의 ---
interface Member {
  id: number;
  name: string;
  position: string;
}

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  date: string;
  category: string;
  amount: number;
  memberId?: number;
  memo?: string;
}

interface DataSnapshot {
  timestamp: string;
  data: {
    members: Member[];
    transactions: Transaction[];
    expenseCategories: string[];
  };
}

// --- 상수 정의 ---
const POSITIONS = ["목사", "사모", "부목사", "전도사", "장로", "권사", "집사", "성도", "청년", "중고등부", "주일학교", "무명", "기타"];
const INCOME_CATEGORIES = ["십일조", "감사헌금", "건축헌금", "선교헌금", "주정헌금", "절기헌금", "생일감사", "심방감사", "일천번제", "기타"];
const todayString = () => new Date().toISOString().slice(0, 10);

const getDayOfWeek = (dateString: string): string => {
    if (!dateString) return '';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(`${dateString}T00:00:00`);
    if (isNaN(date.getTime())) return ''; 
    return `(${days[date.getDay()]})`;
};

// --- LocalStorage를 위한 커스텀 Hook ---
function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(`localStorage 읽기 오류 “${key}”:`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`localStorage 쓰기 오류 “${key}”:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

const PasswordModal: React.FC<{
  mode: 'create' | 'enter';
  onClose: () => void;
  onConfirm: (password: string) => void;
}> = ({ mode, onClose, onConfirm }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{4}$/.test(password)) {
      setError('비밀번호는 4자리 숫자여야 합니다.');
      return;
    }

    if (mode === 'create' && password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    onConfirm(password);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <button onClick={onClose} className="close-btn">&times;</button>
        <h2>{mode === 'create' ? '비밀번호 설정' : '비밀번호 입력'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password-input">{mode === 'create' ? '새 비밀번호 (4자리 숫자)' : '비밀번호'}</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              maxLength={4}
              inputMode="numeric"
              autoComplete="new-password"
              required
              autoFocus
            />
          </div>
          {mode === 'create' && (
            <div className="form-group">
              <label htmlFor="confirm-password-input">비밀번호 확인</label>
              <input
                id="confirm-password-input"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                maxLength={4}
                inputMode="numeric"
                autoComplete="new-password"
                required
              />
            </div>
          )}
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="submit-btn full-width">확인</button>
        </form>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'main' | 'addMember' | 'search' | 'editMembers' | 'snapshots'>('main');
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [churchName, setChurchName] = usePersistentState<string>('church_name_v1', '구미은혜로교회');
  const [members, setMembers] = usePersistentState<Member[]>('church_members_v2', []);
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('church_transactions_v2', []);
  const [expenseCategories, setExpenseCategories] = usePersistentState<string[]>('church_expense_categories_v2', ['구제비', '선교비', '운영비']);
  const [password, setPassword] = usePersistentState<string | null>('church_app_password_v2', null);
  const [snapshots, setSnapshots] = usePersistentState<DataSnapshot[]>('church_data_snapshots_v1', []);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showChurchNameModal, setShowChurchNameModal] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalProps, setPasswordModalProps] = useState({
      mode: 'enter' as 'create' | 'enter',
      onConfirm: (pw: string) => {},
      onClose: () => setShowPasswordModal(false)
  });

  const sortedExpenseCategories = useMemo(() => 
    [...expenseCategories].sort((a, b) => a.localeCompare(b, 'ko')), 
    [expenseCategories]
  );

  const handleAddMember = (name: string, position: string) => {
    if (!name.trim()) {
        alert("성도 이름을 입력해주세요.");
        return;
    }
    const newMember: Member = { id: Date.now(), name, position };
    setMembers(prev => [...prev, newMember].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
    setView('main');
  };

  const handleUpdateMember = (id: number, name: string, position: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, name, position } : m)
                           .sort((a, b) => a.name.localeCompare(b.name, 'ko')));
  };
  
  const handleDeleteMember = (id: number) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleAddTransaction = (tx: Omit<Transaction, 'id'>) => {
    setTransactions(prev => [...prev, { ...tx, id: Date.now() }]);
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
    setTransactions(prev => prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx));
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (id: number) => {
      setTransactions(prev => prev.filter(tx => tx.id !== id));
  };
  
  const handleAddExpenseCategory = (category: string) => {
    if (category && !expenseCategories.includes(category)) {
      setExpenseCategories(prev => [...prev, category].sort((a, b) => a.localeCompare(b, 'ko')));
    }
  };
  
  const handleUpdateExpenseCategory = (oldName: string, newName: string) => {
    if (expenseCategories.includes(newName)) {
      alert('이미 존재하는 항목 이름입니다.');
      return;
    }
    setExpenseCategories(prev => prev.map(c => c === oldName ? newName : c).sort((a, b) => a.localeCompare(b, 'ko')));
    setTransactions(prev => prev.map(tx => 
        (tx.type === 'expense' && tx.category === oldName) 
        ? { ...tx, category: newName } 
        : tx
    ));
  };

  const handleDeleteExpenseCategory = (categoryName: string) => {
      const isUsed = transactions.some(tx => tx.type === 'expense' && tx.category === categoryName);
      let message = `'${categoryName}' 항목을 삭제하시겠습니까?`;
      if (isUsed) {
          message += `\n\n주의: 이 항목을 사용하는 기존 거래 내역이 있습니다.\n항목을 삭제해도 기존 내역은 유지되지만, 목록에서 사라집니다.`;
      }
      if (window.confirm(message)) {
          setExpenseCategories(prev => prev.filter(c => c !== categoryName));
      }
  };

  const runProtectedAction = (action: () => void) => {
    if (password) {
      setPasswordModalProps({
        mode: 'enter',
        onConfirm: (enteredPassword) => {
          if (enteredPassword === password) {
            setShowPasswordModal(false);
            action();
          } else {
            alert('비밀번호가 올바르지 않습니다.');
          }
        },
        onClose: () => setShowPasswordModal(false)
      });
    } else {
      setPasswordModalProps({
        mode: 'create',
        onConfirm: (newPassword) => {
          setPassword(newPassword);
          setShowPasswordModal(false);
          action();
        },
        onClose: () => setShowPasswordModal(false)
      });
    }
    setShowPasswordModal(true);
  };

  const handleSaveData = () => {
    const performSave = () => {
      try {
        const dataToSave = { members, transactions, expenseCategories };
        const newSnapshot: DataSnapshot = {
          timestamp: new Date().toISOString(),
          data: dataToSave,
        };
        setSnapshots(prev => [newSnapshot, ...prev].slice(0, 50));
        const prettyJsonString = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([prettyJsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileName = `헌금_${todayString()}.json`;
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (window.confirm(`데이터가 앱 내 목록과 컴퓨터에 백업되었습니다.\n'${fileName}' 파일이 다운로드 폴더에 저장되었습니다.\n\n확인을 누르면 네이버 밴드로 이동하여 파일을 공유할 수 있습니다.`)) {
            window.open('https://band.us', '_blank');
        }
      } catch (error) {
        console.error('데이터 저장 오류:', error);
        alert('데이터 저장 중 오류가 발생했습니다.');
      }
    };
    runProtectedAction(performSave);
  };
  

  const handleLoadData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const inputElement = event.target;
    const performLoad = () => {
        if (!window.confirm('데이터를 불러오면 현재 데이터가 모두 덮어쓰여집니다. 계속하시겠습니까?')) {
            inputElement.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("파일을 읽을 수 없습니다.");
                const parsedData = JSON.parse(text);
                if (typeof parsedData !== 'object' || parsedData === null || !Array.isArray(parsedData.members) || !Array.isArray(parsedData.transactions)) {
                    alert('파일의 데이터 구조가 올바르지 않아 불러올 수 없습니다.');
                    return;
                }
                setMembers(parsedData.members);
                setTransactions(parsedData.transactions);
                if (Array.isArray(parsedData.expenseCategories)) {
                    setExpenseCategories(parsedData.expenseCategories.sort((a: string, b: string) => a.localeCompare(b, 'ko')));
                    alert('데이터를 성공적으로 불러왔습니다.');
                } else {
                    const defaultExpenseCategories = ['구제비', '선교비', '운영비'].sort((a, b) => a.localeCompare(b, 'ko'));
                    setExpenseCategories(defaultExpenseCategories);
                    alert('이전 버전의 데이터를 불러왔습니다. 지출 항목은 기본값으로 설정됩니다.');
                }
            } catch (error) {
                console.error("데이터 불러오기 오류:", error);
                alert('데이터를 불러오는 중 오류가 발생했습니다. 파일이 손상되었거나 형식이 다를 수 있습니다.');
            } finally {
                inputElement.value = '';
            }
        };
        reader.readAsText(file);
    };
    runProtectedAction(performLoad);
  };
  
    const handleLoadSnapshot = (snapshotData: DataSnapshot['data']) => {
      if (window.confirm('저장된 데이터를 불러오면 현재 작업 내용이 모두 덮어쓰여집니다. 계속하시겠습니까?')) {
          setMembers(snapshotData.members);
          setTransactions(snapshotData.transactions);
          setExpenseCategories(snapshotData.expenseCategories.sort((a, b) => a.localeCompare(b, 'ko')));
          setView('main');
          alert('데이터를 성공적으로 불러왔습니다.');
      }
    };

    const handleDeleteSnapshot = (timestamp: string) => {
        const performDelete = () => {
            if (window.confirm(`${new Date(timestamp).toLocaleString('ko-KR')}에 저장된 데이터를 삭제하시겠습니까?`)) {
                setSnapshots(prev => prev.filter(s => s.timestamp !== timestamp));
            }
        }
        runProtectedAction(performDelete);
    };

  const { sortedTransactions, balanceData, periodicalSummary, weeklyCategoryTotals, transactionsWithBalance, availableYears } = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);
    
    const todayStr = todayString();
    let previousBalance = 0;
    let todaysChange = 0;

    transactions.forEach(tx => {
        const amount = tx.type === 'income' ? tx.amount : -tx.amount;
        if (tx.date < todayStr) {
            previousBalance += amount;
        } else if (tx.date === todayStr) {
            todaysChange += amount;
        }
    });

    const todaysBalance = previousBalance + todaysChange;
    const categoryOrder = ["기타", "일천번제", "심방감사", "생일감사", "절기헌금", "주정헌금", "감사헌금", "건축헌금", "선교헌금", "십일조"];
    
    const getMemberNameForSort = (memberId?: number): string => {
        if (memberId === undefined) return '무명';
        return members.find(m => m.id === memberId)?.name || '미지정';
    };

    let runningBalance = 0;
    const withBalance = [...transactions]
        .sort((a, b) => {
            const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateCompare !== 0) return dateCompare;
            if (a.type !== b.type) {
                return a.type === 'income' ? -1 : 1;
            }
            if (a.type === 'income') {
                const indexA = categoryOrder.indexOf(a.category);
                const indexB = categoryOrder.indexOf(b.category);
                const effectiveIndexA = indexA === -1 ? categoryOrder.length : indexA;
                const effectiveIndexB = indexB === -1 ? categoryOrder.length : indexB;
                if (effectiveIndexA !== effectiveIndexB) {
                    return effectiveIndexA - effectiveIndexB;
                }
                const nameA = getMemberNameForSort(a.memberId);
                const nameB = getMemberNameForSort(b.memberId);
                const nameCompare = nameB.localeCompare(nameA, 'ko');
                if (nameCompare !== 0) return nameCompare;
            }
            if (a.type === 'expense') {
                const catCompare = b.category.localeCompare(a.category, 'ko');
                if (catCompare !== 0) return catCompare;
                const memoA = a.memo || '';
                const memoB = b.memo || '';
                const memoCompare = memoB.localeCompare(memoA, 'ko');
                if (memoCompare !== 0) return memoCompare;
            }
            return a.id - b.id;
        })
        .map(tx => {
            runningBalance += (tx.type === 'income' ? tx.amount : -tx.amount);
            return { ...tx, balance: runningBalance };
        })
        .reverse();
        
    const today = new Date(todayStr);
    const yearStartStr = today.getFullYear() + '-01-01';
    
    // For selected year calculations
    const selectedYearStartStr = `${selectedYear}-01-01`;
    const selectedYearEndStr = `${selectedYear}-12-31`;

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); 
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    let weeklyIncome = 0;
    let weeklyExpense = 0;
    let yearlyIncome = 0;
    let yearlyExpense = 0;
    
    const gyeongsangbiCategories = ["십일조", "주정헌금", "감사헌금", "절기헌금"];
    
    const weeklyGyeongsangbiBreakdown: { [key: string]: number } = Object.fromEntries(
        gyeongsangbiCategories.map(cat => [cat, 0])
    );
    const yearlyGyeongsangbiBreakdown: { [key: string]: number } = Object.fromEntries(
        gyeongsangbiCategories.map(cat => [cat, 0])
    );

    let weeklySeongyo = 0;
    let weeklyGeonchuk = 0;
    let yearlySeongyo = 0;
    let yearlyGeonchuk = 0;

    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    
    transactions.forEach(tx => {
        const amount = tx.amount;
        const txDate = tx.date;
        const txYear = new Date(txDate).getFullYear();
        if (!isNaN(txYear)) yearsSet.add(txYear);

        // Periodical Summary logic (this still uses real-time "this year" for top display)
        if (txDate >= yearStartStr) {
            if (tx.type === 'income') yearlyIncome += amount;
            else yearlyExpense += amount;
        }

        // Selected Year logic for breakdown
        if (txDate >= selectedYearStartStr && txDate <= selectedYearEndStr) {
            if (tx.type === 'income') {
                if (gyeongsangbiCategories.includes(tx.category)) {
                    yearlyGyeongsangbiBreakdown[tx.category] += amount;
                } else if (tx.category === '선교헌금') {
                    yearlySeongyo += amount;
                } else if (tx.category === '건축헌금') {
                    yearlyGeonchuk += amount;
                }
            }
        }

        // Weekly logic
        if (txDate >= weekStartStr) {
            if (tx.type === 'income') {
                weeklyIncome += amount;
                if (gyeongsangbiCategories.includes(tx.category)) {
                    weeklyGyeongsangbiBreakdown[tx.category] += amount;
                } else if (tx.category === '선교헌금') {
                    weeklySeongyo += amount;
                } else if (tx.category === '건축헌금') {
                    weeklyGeonchuk += amount;
                }
            } else {
                weeklyExpense += amount;
            }
        }
    });

    return {
      sortedTransactions: sorted,
      balanceData: { previousBalance, todaysChange, todaysBalance },
      periodicalSummary: {
          weeklyIncome,
          weeklyExpense,
          yearlyIncome,
          yearlyExpense,
          weeklyBalance: weeklyIncome - weeklyExpense,
          yearlyBalance: yearlyIncome - yearlyExpense,
      },
      weeklyCategoryTotals: {
          weeklyGyeongsangbiBreakdown,
          yearlyGyeongsangbiBreakdown,
          weeklySeongyo,
          weeklyGeonchuk,
          yearlySeongyo,
          yearlyGeonchuk
      },
      transactionsWithBalance: withBalance,
      availableYears: Array.from(yearsSet).sort((a, b) => b - a),
    };
  }, [transactions, members, selectedYear]);
  
  const getMemberName = (id?: number) => members.find(m => m.id === id)?.name || '미지정';

  return (
    <>
      <header>
        <div className="church-title-container" onClick={() => runProtectedAction(() => setShowChurchNameModal(true))}>
            <h1>{churchName} 헌금관리</h1>
            <span className="edit-badge">수정</span>
        </div>
        <div className="header-actions">
            <button onClick={() => setView('addMember')}>새 성도 추가</button>
            <button onClick={() => setView('search')}>조회</button>
            <button onClick={() => runProtectedAction(() => setView('editMembers'))}>회원수정</button>
            <button onClick={() => setView('snapshots')}>저장 목록</button>
        </div>
      </header>
      <div className="data-management top-data-management">
          <button onClick={handleSaveData} className="data-btn">데이터 저장</button>
          <label htmlFor="load-data-input-header" className="data-btn">
              데이터 불러오기
          </label>
          <input 
              id="load-data-input-header"
              type="file"
              accept=".json"
              onChange={handleLoadData}
              style={{ display: 'none' }}
          />
      </div>
      <main>
        {view === 'main' && (
          <>
            <div className="card">
              <div className="tabs">
                <button className={`tab-button ${activeTab === 'income' ? 'active' : ''}`} onClick={() => setActiveTab('income')}>입금</button>
                <button className={`tab-button ${activeTab === 'expense' ? 'active' : ''}`} onClick={() => setActiveTab('expense')}>출금</button>
              </div>
              {activeTab === 'income' ? (
                <IncomeForm members={members} onAddTransaction={handleAddTransaction} />
              ) : (
                <ExpenseForm 
                    members={members} 
                    categories={sortedExpenseCategories} 
                    onAddCategory={handleAddExpenseCategory} 
                    onAddTransaction={handleAddTransaction} 
                    onManageCategories={() => runProtectedAction(() => setShowCategoryManager(true))}
                />
              )}
            </div>
            <PeriodicalSummary {...periodicalSummary} />
            <WeeklyCategorySummary 
                {...weeklyCategoryTotals} 
                selectedYear={selectedYear} 
                onYearChange={setSelectedYear} 
                availableYears={availableYears}
            />
            <BalanceSummary {...balanceData} />
            <TransactionList 
              transactions={transactionsWithBalance} 
              getMemberName={getMemberName}
              onSaveData={handleSaveData}
              onLoadData={handleLoadData}
              onEdit={tx => runProtectedAction(() => setEditingTransaction(tx))}
              onDelete={id => runProtectedAction(() => {
                  if (window.confirm('이 거래 내역을 정말로 삭제하시겠습니까?')) {
                      handleDeleteTransaction(id);
                  }
              })}
            />
          </>
        )}
        {view === 'addMember' && <AddMemberModal onAddMember={handleAddMember} onClose={() => setView('main')} />}
        {view === 'editMembers' && <EditMembersModal members={members} onClose={() => setView('main')} onUpdateMember={handleUpdateMember} onDeleteMember={handleDeleteMember} />}
        {view === 'search' && <SearchModal transactions={transactions} members={members} getMemberName={getMemberName} incomeCategories={INCOME_CATEGORIES} expenseCategories={sortedExpenseCategories} onClose={() => setView('main')} />}
        {view === 'snapshots' && <SnapshotsModal snapshots={snapshots} onClose={() => setView('main')} onLoad={handleLoadSnapshot} onDelete={handleDeleteSnapshot} />}
        
        {editingTransaction && (
            <EditTransactionModal
                transaction={editingTransaction}
                onClose={() => setEditingTransaction(null)}
                onSave={handleUpdateTransaction}
                members={members}
                incomeCategories={INCOME_CATEGORIES}
                expenseCategories={sortedExpenseCategories}
                onAddCategory={handleAddExpenseCategory}
            />
        )}
        {showPasswordModal && <PasswordModal {...passwordModalProps} />}
        {showCategoryManager && (
            <ManageExpenseCategoriesModal
                categories={sortedExpenseCategories}
                onClose={() => setShowCategoryManager(false)}
                onUpdate={handleUpdateExpenseCategory}
                onDelete={handleDeleteExpenseCategory}
            />
        )}
        {showChurchNameModal && (
            <div className="modal-backdrop">
                <div className="modal-content">
                    <button onClick={() => setShowChurchNameModal(false)} className="close-btn">&times;</button>
                    <h2>교회 이름 수정</h2>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const newName = (e.target as any).churchName.value;
                        if (newName.trim()) {
                            setChurchName(newName.trim());
                            setShowChurchNameModal(false);
                        }
                    }}>
                        <div className="form-group">
                            <label htmlFor="churchName">교회 이름</label>
                            <input id="churchName" name="churchName" defaultValue={churchName} required autoFocus />
                        </div>
                        <button type="submit" className="submit-btn full-width">저장</button>
                    </form>
                </div>
            </div>
        )}
      </main>
    </>
  );
};

// --- 컴포넌트들 ---

const WeeklyCategorySummary: React.FC<{
  weeklyGyeongsangbiBreakdown: { [key: string]: number };
  yearlyGyeongsangbiBreakdown: { [key: string]: number };
  weeklySeongyo: number;
  weeklyGeonchuk: number;
  yearlySeongyo: number;
  yearlyGeonchuk: number;
  selectedYear: number;
  onYearChange: (year: number) => void;
  availableYears: number[];
}> = ({ 
    weeklyGyeongsangbiBreakdown, 
    yearlyGyeongsangbiBreakdown, 
    weeklySeongyo, 
    weeklyGeonchuk, 
    yearlySeongyo, 
    yearlyGeonchuk,
    selectedYear,
    onYearChange,
    availableYears
}) => {
    const displayOrder = ["십일조", "주정헌금", "감사헌금", "절기헌금"];
    
    return (
        <section className="card periodical-summary category-breakdown-summary">
            <div className="summary-header-with-year" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-color)' }}>항목별 집계</h3>
                <div className="year-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label htmlFor="year-select" style={{ fontSize: '0.9rem', color: '#666' }}>조회 년도:</label>
                    <select 
                        id="year-select" 
                        value={selectedYear} 
                        onChange={(e) => onYearChange(Number(e.target.value))}
                        style={{ padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.95rem' }}
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}년</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="summary-row">
                <span className="row-label">경상비</span>
                <div className="row-values gyeongsangbi">
                    {displayOrder.map(category => (
                        <div className="value-item" key={category}>
                        <span className="value-label">
                            {category === '주정헌금' ? '주일헌금' : category}
                        </span>
                        <span className="value-amount">{weeklyGyeongsangbiBreakdown[category].toLocaleString()}원</span>
                        <span style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                            ({selectedYear}년: {yearlyGyeongsangbiBreakdown[category].toLocaleString()})
                        </span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="summary-row">
                <span className="row-label">특별헌금</span>
                <div className="row-values">
                    <div className="value-item">
                        <span className="value-label">선교헌금</span>
                        <span className="value-amount">{weeklySeongyo.toLocaleString()}원</span>
                        <span style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                            ({selectedYear}년: {yearlySeongyo.toLocaleString()})
                        </span>
                    </div>
                    <div className="value-item">
                        <span className="value-label">건축헌금</span>
                        <span className="value-amount">{weeklyGeonchuk.toLocaleString()}원</span>
                        <span style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                            ({selectedYear}년: {yearlyGeonchuk.toLocaleString()})
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
};

const PeriodicalSummary: React.FC<{
  weeklyIncome: number;
  weeklyExpense: number;
  yearlyIncome: number;
  yearlyExpense: number;
  weeklyBalance: number;
  yearlyBalance: number;
}> = ({ weeklyIncome, weeklyExpense, yearlyIncome, yearlyExpense, weeklyBalance, yearlyBalance }) => (
  <section className="card periodical-summary">
    <div className="summary-row">
      <span className="row-label income-color">수입</span>
      <div className="row-values">
        <div className="value-item">
          <span className="value-label">금주 총액</span>
          <span className="value-amount">{weeklyIncome.toLocaleString()}원</span>
        </div>
        <div className="value-item">
          <span className="value-label">금년 총액</span>
          <span className="value-amount">{yearlyIncome.toLocaleString()}원</span>
        </div>
      </div>
    </div>
    <div className="summary-row">
      <span className="row-label expense-color">지출</span>
      <div className="row-values">
        <div className="value-item">
          <span className="value-label">금주 총액</span>
          <span className="value-amount">{weeklyExpense.toLocaleString()}원</span>
        </div>
        <div className="value-item">
          <span className="value-label">금년 총액</span>
          <span className="value-amount">{yearlyExpense.toLocaleString()}원</span>
        </div>
      </div>
    </div>
    <div className="summary-row">
      <span className="row-label">잔액</span>
      <div className="row-values">
        <div className="value-item">
          <span className="value-label">금주 잔액</span>
          <span className="value-amount">{weeklyBalance.toLocaleString()}원</span>
        </div>
        <div className="value-item">
          <span className="value-label">금년 잔액</span>
          <span className="value-amount">{yearlyBalance.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  </section>
);

const BalanceSummary: React.FC<{previousBalance: number, todaysChange: number, todaysBalance: number}> = ({ previousBalance, todaysChange, todaysBalance }) => (
  <section className="balance-summary">
    <div className="summary-item">
      <span className="summary-label">이전 잔액</span>
      <span className="summary-value">{previousBalance.toLocaleString()}원</span>
    </div>
    <div className="summary-item">
      <span className="summary-label">오늘 변동금액</span>
      <span className={`summary-value ${todaysChange >= 0 ? 'income-color' : 'expense-color'}`}>{todaysChange.toLocaleString()}원</span>
    </div>
    <div className="summary-item">
      <span className="summary-label">금일 잔액</span>
      <span className="summary-value bold" style={{ color: '#d50000' }}>{todaysBalance.toLocaleString()}원</span>
    </div>
  </section>
);

const IncomeForm: React.FC<{members: Member[], onAddTransaction: (tx: Omit<Transaction, 'id'>) => void}> = ({ members, onAddTransaction }) => {
  const [date, setDate] = useState(todayString);
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]);
  const [memberId, setMemberId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [showAmountHelper, setShowAmountHelper] = useState(false);
  const presets = [1000, 5000, 10000, 50000, 100000];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (amount === '' || Number(amount) <= 0 || memberId === '') {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }
    onAddTransaction({ type: 'income', date, category, amount: Number(amount), memberId: Number(memberId) });
    setMemberId('');
    setAmount('');
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="form-group">
        <label htmlFor="income-date" className="label-with-day">
          <span>입금 날짜</span>
          <span>{getDayOfWeek(date)}</span>
        </label>
        <input id="income-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="income-category">입금 내역</label>
        <select id="income-category" value={category} onChange={e => setCategory(e.target.value)}>
          {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="income-member">헌금자</label>
        <select id="income-member" value={memberId} onChange={e => setMemberId(Number(e.target.value))} required>
          <option value="" disabled>-- 성도 선택 --</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.position})</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="income-amount">금액 (원)</label>
        <div className="amount-input-container">
            <input 
                id="income-amount" 
                type="number" 
                placeholder="숫자만 입력" 
                value={amount} 
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                required 
                min="1" 
            />
            <button 
                type="button" 
                className="toggle-amount-helper-btn" 
                onClick={() => setShowAmountHelper(prev => !prev)}
                aria-label="금액 선택 도우미 열기/닫기"
                aria-expanded={showAmountHelper}
            >
                ₩
            </button>
        </div>
        {showAmountHelper && (
            <div className="amount-helper">
                {presets.map(preset => (
                    <div key={preset} className="amount-preset-row">
                        <button type="button" className="amount-preset-btn" onClick={() => setAmount(preset)}>
                            {preset.toLocaleString()}원
                        </button>
                        <div className="amount-adjust-btns">
                            <button type="button" onClick={() => setAmount(prev => (Number(prev) || 0) + preset)} aria-label={`${preset.toLocaleString()}원 더하기`}>+</button>
                            <button type="button" onClick={() => setAmount(prev => Math.max(0, (Number(prev) || 0) - preset))} aria-label={`${preset.toLocaleString()}원 빼기`}>-</button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
      <button type="submit" className="submit-btn">등록 완료</button>
    </form>
  );
};

const ExpenseForm: React.FC<{
    members: Member[], 
    categories: string[], 
    onAddCategory: (cat: string) => void, 
    onAddTransaction: (tx: Omit<Transaction, 'id'>) => void,
    onManageCategories: () => void
}> = ({ members, categories, onAddCategory, onAddTransaction, onManageCategories }) => {
  const [date, setDate] = useState(todayString);
  const [category, setCategory] = useState(categories[0] || '');
  const [memberId, setMemberId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [memo, setMemo] = useState('');
  
  const [showAmountHelper, setShowAmountHelper] = useState(false);
  const presets = [1000, 5000, 10000, 50000, 100000];
  
  const handleAddCategory = () => {
    const newCategory = prompt('추가할 출금 항목 이름을 입력하세요:');
    if (newCategory) onAddCategory(newCategory.trim());
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (amount === '' || amount <= 0 || !category) {
      alert('출금 내역과 금액을 정확히 입력해주세요.');
      return;
    }
    onAddTransaction({ type: 'expense', date, category, amount: Number(amount), memberId: memberId === '' ? undefined : Number(memberId), memo });
    setMemberId('');
    setAmount('');
    setMemo('');
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="form-group">
        <label htmlFor="expense-date" className="label-with-day">
          <span>출금 날짜</span>
          <span>{getDayOfWeek(date)}</span>
        </label>
        <input id="expense-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="expense-category">출금 내역</label>
        <div className="category-input">
          <select id="expense-category" value={category} onChange={e => setCategory(e.target.value)} required>
            <option value="" disabled>-- 항목 선택 --</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={handleAddCategory} className="add-category-btn" title="새 항목 추가">+</button>
          <button type="button" onClick={onManageCategories} className="manage-category-btn" title="항목 관리">⚙️</button>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="expense-user">사용자</label>
        <select id="expense-user" value={memberId} onChange={e => setMemberId(Number(e.target.value))}>
          <option value="">-- 선택 사항 --</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.position})</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="expense-amount">금액 (원)</label>
        <div className="amount-input-container">
            <input 
                id="expense-amount" 
                type="number" 
                placeholder="숫자만 입력" 
                value={amount} 
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                required 
                min="1" 
            />
            <button 
                type="button" 
                className="toggle-amount-helper-btn" 
                onClick={() => setShowAmountHelper(prev => !prev)}
                aria-label="금액 선택 도우미 열기/닫기"
                aria-expanded={showAmountHelper}
            >
                ₩
            </button>
        </div>
        {showAmountHelper && (
            <div className="amount-helper">
                {presets.map(preset => (
                    <div key={preset} className="amount-preset-row">
                        <button type="button" className="amount-preset-btn" onClick={() => setAmount(preset)}>
                            {preset.toLocaleString()}원
                        </button>
                        <div className="amount-adjust-btns">
                            <button type="button" onClick={() => setAmount(prev => (Number(prev) || 0) + preset)} aria-label={`${preset.toLocaleString()}원 더하기`}>+</button>
                            <button type="button" onClick={() => setAmount(prev => Math.max(0, (Number(prev) || 0) - preset))} aria-label={`${preset.toLocaleString()}원 빼기`}>-</button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
      <div className="form-group">
        <label htmlFor="expense-memo">비고</label>
        <input id="expense-memo" type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모 (선택사항)" />
      </div>
      <button type="submit" className="submit-btn">등록</button>
    </form>
  );
};

const TransactionList: React.FC<{
  transactions: (Transaction & {balance: number})[], 
  getMemberName: (id?: number) => string,
  onSaveData: () => void,
  onLoadData: (event: ChangeEvent<HTMLInputElement>) => void,
  onEdit: (tx: Transaction) => void,
  onDelete: (id: number) => void
}> = ({ transactions, getMemberName, onSaveData, onLoadData, onEdit, onDelete }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;
    const PAGES_PER_GROUP = 15;

    useEffect(() => {
        setCurrentPage(1);
    }, [transactions]);

    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
    const startPage = Math.floor((currentPage - 1) / PAGES_PER_GROUP) * PAGES_PER_GROUP + 1;
    const endPage = Math.min(startPage + PAGES_PER_GROUP - 1, totalPages);
    const paginatedTransactions = transactions.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );
    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };
    
    return (
        <section className="card">
            <h2>거래 내역</h2>
            <div className="transaction-list">
                <div className="transaction-header">
                    <span>날짜</span>
                    <span>입금</span>
                    <span>출금</span>
                    <span>금액</span>
                    <span>잔액</span>
                    <span>작업</span>
                </div>
                {transactions.length === 0 ? (
                    <p className="empty-list">거래 내역이 없습니다.</p>
                ) : (
                    paginatedTransactions.map(({ balance, ...tx }) => (
                        <div key={tx.id} className={`transaction-item ${tx.type}`}>
                            <span>{tx.date}</span>
                            <span>{tx.type === 'income' ? `${getMemberName(tx.memberId)} (${tx.category})` : '-'}</span>
                            <span>{tx.type === 'expense' ? `${tx.category}${tx.memo ? ` (${tx.memo})` : ''}` : '-'}</span>
                            <span className={tx.type === 'income' ? 'income-color' : 'expense-color'}>{tx.amount.toLocaleString()}원</span>
                            <span>{balance.toLocaleString()}원</span>
                            <div className="transaction-actions">
                                <button onClick={() => onEdit(tx)} className="action-btn edit">수정</button>
                                <button onClick={() => onDelete(tx.id)} className="action-btn delete">삭제</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            {totalPages > 1 && (
                <div className="pagination-controls">
                    {startPage > 1 && <button onClick={() => handlePageChange(startPage - 1)}>&lt;&lt;</button>}
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>&lt;</button>
                    {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(page => (
                        <button key={page} onClick={() => handlePageChange(page)} className={currentPage === page ? 'active' : ''}>{page}</button>
                    ))}
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>&gt;</button>
                    {endPage < totalPages && <button onClick={() => handlePageChange(endPage + 1)}>&gt;&gt;</button>}
                </div>
            )}
            <div className="data-management">
                <button onClick={onSaveData} className="data-btn">데이터 저장</button>
                <label htmlFor="load-data-input" className="data-btn">데이터 불러오기</label>
                <input id="load-data-input" type="file" accept=".json" onChange={onLoadData} style={{ display: 'none' }} />
            </div>
        </section>
    );
};

const AddMemberModal: React.FC<{onAddMember: (name: string, position: string) => void, onClose: () => void}> = ({ onAddMember, onClose }) => {
  const [name, setName] = useState('');
  const [position, setPosition] = useState(POSITIONS[0]);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onAddMember(name, position);
  };
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <button onClick={onClose} className="close-btn">&times;</button>
        <h2>새 성도 추가</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-member-name">이름</label>
            <input id="new-member-name" type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="new-member-position">직분</label>
            <select id="new-member-position" value={position} onChange={e => setPosition(e.target.value)}>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button type="submit" className="submit-btn">추가</button>
        </form>
      </div>
    </div>
  );
};

const EditMembersModal: React.FC<{
    members: Member[];
    onClose: () => void;
    onUpdateMember: (id: number, newName: string, newPosition: string) => void;
    onDeleteMember: (id: number) => void;
}> = ({ members, onClose, onUpdateMember, onDeleteMember }) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editPosition, setEditPosition] = useState('');
    const handleEditStart = (member: Member) => {
        setEditingId(member.id);
        setEditName(member.name);
        setEditPosition(member.position);
    };
    const handleEditSave = () => {
        if (editingId && editName.trim()) {
            onUpdateMember(editingId, editName.trim(), editPosition);
            setEditingId(null);
        } else alert('이름을 입력해주세요.');
    };
    const handleDelete = (member: Member) => {
        if (window.confirm(`${member.name} (${member.position}) 님을 삭제하시겠습니까?\n관련된 모든 거래 내역은 유지되지만, 이름이 '미지정'으로 표시됩니다.`)) {
            onDeleteMember(member.id);
        }
    };
    return (
        <div className="modal-backdrop">
            <div className="modal-content large">
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>회원 수정 및 삭제</h2>
                <ul className="member-list">
                    {members.map(member => (
                        <li key={member.id} className="member-item">
                            {editingId === member.id ? (
                                <>
                                    <div className="edit-form">
                                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                                        <select value={editPosition} onChange={(e) => setEditPosition(e.target.value)}>
                                            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div className="member-actions">
                                        <button onClick={handleEditSave} className="save-btn">저장</button>
                                        <button onClick={() => setEditingId(null)} className="cancel-btn">취소</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="member-info">
                                        <span>{member.name}</span>
                                        <small>{member.position}</small>
                                    </div>
                                    <div className="member-actions">
                                        <button onClick={() => handleEditStart(member)} className="edit-btn">수정</button>
                                        <button onClick={() => handleDelete(member)} className="delete-btn">삭제</button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const ManageExpenseCategoriesModal: React.FC<{
    categories: string[];
    onClose: () => void;
    onUpdate: (oldName: string, newName: string) => void;
    onDelete: (name: string) => void;
}> = ({ categories, onClose, onUpdate, onDelete }) => {
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const startEdit = (cat: string) => {
        setEditingCategory(cat);
        setEditValue(cat);
    };
    const saveEdit = () => {
        if (editingCategory && editValue.trim() && editValue !== editingCategory) {
            onUpdate(editingCategory, editValue.trim());
        }
        setEditingCategory(null);
    };
    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>출금 항목 관리</h2>
                <ul className="member-list">
                    {categories.map(cat => (
                        <li key={cat} className="member-item">
                            {editingCategory === cat ? (
                                <>
                                    <div className="edit-form">
                                        <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />
                                    </div>
                                    <div className="member-actions">
                                        <button onClick={saveEdit} className="save-btn">저장</button>
                                        <button onClick={() => setEditingCategory(null)} className="cancel-btn">취소</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span>{cat}</span>
                                    <div className="member-actions">
                                        <button onClick={() => startEdit(cat)} className="edit-btn">수정</button>
                                        <button onClick={() => onDelete(cat)} className="delete-btn">삭제</button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const EditTransactionModal: React.FC<{
    transaction: Transaction;
    onClose: () => void;
    onSave: (tx: Transaction) => void;
    members: Member[];
    incomeCategories: string[];
    expenseCategories: string[];
    onAddCategory: (cat: string) => void;
}> = ({ transaction, onClose, onSave, members, incomeCategories, expenseCategories, onAddCategory }) => {
    const [formData, setFormData] = useState<Transaction>(transaction);
    useEffect(() => setFormData(transaction), [transaction]);
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let processedValue: string | number | undefined = value;
        if (name === 'amount') processedValue = value === '' ? 0 : Number(value);
        else if (name === 'memberId') processedValue = value === '' ? undefined : Number(value);
        setFormData(prev => ({ ...prev, [name]: processedValue }));
    };
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (formData.amount <= 0) { alert('금액은 0보다 커야 합니다.'); return; }
        if (formData.type === 'income' && !formData.memberId) { alert('헌금자를 선택해주세요.'); return; }
        onSave(formData);
    };
    const handleAddCategory = () => {
        const newCategory = prompt('추가할 출금 항목 이름을 입력하세요:');
        if (newCategory) onAddCategory(newCategory.trim());
    };
    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>거래 내역 수정</h2>
                <form onSubmit={handleSubmit} className="transaction-form">
                    <div className="form-group">
                        <label htmlFor="edit-date" className="label-with-day">
                            <span>날짜</span>
                            <span>{getDayOfWeek(formData.date)}</span>
                        </label>
                        <input id="edit-date" name="date" type="date" value={formData.date} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="edit-amount">금액 (원)</label>
                        <input id="edit-amount" name="amount" type="number" value={formData.amount} onChange={handleChange} required min="1" />
                    </div>
                    {formData.type === 'income' ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="edit-income-category">입금 내역</label>
                                <select id="edit-income-category" name="category" value={formData.category} onChange={handleChange}>
                                    {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-income-member">헌금자</label>
                                <select id="edit-income-member" name="memberId" value={formData.memberId || ''} onChange={handleChange} required>
                                    <option value="" disabled>-- 성도 선택 --</option>
                                    {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.position})</option>)}
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-group">
                                <label htmlFor="edit-expense-category">출금 내역</label>
                                <div className="category-input">
                                    <select id="edit-expense-category" name="category" value={formData.category} onChange={handleChange} required>
                                        <option value="" disabled>-- 항목 선택 --</option>
                                        {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <button type="button" onClick={handleAddCategory} className="add-category-btn">+</button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-expense-user">사용자</label>
                                <select id="edit-expense-user" name="memberId" value={formData.memberId || ''} onChange={handleChange}>
                                    <option value="">-- 선택 사항 --</option>
                                    {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.position})</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label htmlFor="edit-expense-memo">비고</label>
                                <input id="edit-expense-memo" name="memo" type="text" value={formData.memo || ''} onChange={handleChange} placeholder="메모 (선택사항)" />
                            </div>
                        </>
                    )}
                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="cancel-btn form-btn">취소</button>
                        <button type="submit" className="submit-btn form-btn">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SnapshotsModal: React.FC<{
    snapshots: DataSnapshot[];
    onClose: () => void;
    onLoad: (snapshotData: DataSnapshot['data']) => void;
    onDelete: (timestamp: string) => void;
}> = ({ snapshots, onClose, onLoad, onDelete }) => (
    <div className="modal-backdrop">
        <div className="modal-content large">
            <button onClick={onClose} className="close-btn">&times;</button>
            <h2>저장된 데이터 목록</h2>
            {snapshots.length === 0 ? <p className="empty-list">저장된 데이터가 없습니다.</p> : (
                <ul className="snapshot-list">
                    {snapshots.map(snapshot => (
                        <li key={snapshot.timestamp} className="snapshot-item">
                            <div className="snapshot-info">
                                <span>{new Date(snapshot.timestamp).toLocaleString('ko-KR')}</span>
                                <small>성도: {snapshot.data.members.length}명, 거래: {snapshot.data.transactions.length}건</small>
                            </div>
                            <div className="snapshot-actions">
                                <button onClick={() => onLoad(snapshot.data)} className="load-btn">불러오기</button>
                                <button onClick={() => onDelete(snapshot.timestamp)} className="delete-btn">삭제</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    </div>
);

const SearchModal: React.FC<{
    transactions: Transaction[], 
    members: Member[], 
    getMemberName: (id?: number) => string,
    incomeCategories: string[],
    expenseCategories: string[],
    onClose: () => void
}> = ({ transactions, members, getMemberName, incomeCategories, expenseCategories, onClose }) => {
    const [searchType, setSearchType] = useState<'name' | 'category' | 'amount'>('name');
    const [nameQuery, setNameQuery] = useState<number | ''>('');
    const [categoryType, setCategoryType] = useState<'income' | 'expense'>('income');
    const [categoryQuery, setCategoryQuery] = useState('');
    const [amountQuery, setAmountQuery] = useState<number | ''>('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(todayString);
    const filteredTransactions = useMemo(() => transactions.filter(tx => tx.date >= startDate && tx.date <= endDate), [transactions, startDate, endDate]);
    const todaysTotals = useMemo(() => {
        const today = todayString();
        const todaysTransactions = transactions.filter(tx => tx.date === today);
        const totalIncome = todaysTransactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
        const totalExpense = todaysTransactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
        return { totalIncome, totalExpense };
    }, [transactions]);
    const nameSearchResult = useMemo(() => {
        if (searchType !== 'name' || nameQuery === '') return null;
        const result = filteredTransactions.filter(tx => tx.memberId === nameQuery && tx.type === 'income');
        const total = result.reduce((sum, tx) => sum + tx.amount, 0);
        return { transactions: result, total };
    }, [filteredTransactions, searchType, nameQuery]);

    const categorySearchResult = useMemo(() => {
        if (searchType !== 'category' || categoryQuery === '') return null;
        
        const matchingTransactions = filteredTransactions.filter(tx => {
            if (tx.type !== categoryType) return false;
            if (categoryQuery === 'ALL') return true;
            return tx.category === categoryQuery;
        });

        const grandTotal = matchingTransactions.reduce((sum, tx) => sum + tx.amount, 0);

        // Calculate breakdown only if 'ALL' is selected
        let breakdown: { category: string, total: number }[] = [];
        if (categoryQuery === 'ALL') {
            const categoriesToUse = categoryType === 'income' ? incomeCategories : expenseCategories;
            breakdown = categoriesToUse.map(cat => ({
                category: cat,
                total: matchingTransactions.filter(tx => tx.category === cat).reduce((sum, tx) => sum + tx.amount, 0)
            })).filter(item => item.total > 0 || categoryType === 'income'); // Keep all income cats per user request order, filter empty expenses if preferred
            
            // If it's income, make sure it matches the exact requested sequence
            if (categoryType === 'income') {
                breakdown = incomeCategories.map(cat => ({
                    category: cat,
                    total: matchingTransactions.filter(tx => tx.category === cat).reduce((sum, tx) => sum + tx.amount, 0)
                }));
            }
        }

        return { transactions: matchingTransactions, total: grandTotal, breakdown };
    }, [filteredTransactions, searchType, categoryType, categoryQuery, incomeCategories, expenseCategories]);

    const amountSearchResult = useMemo(() => {
        if (searchType !== 'amount' || amountQuery === '' || amountQuery === 0) return null;
        const result = filteredTransactions.filter(tx => tx.amount === Number(amountQuery));
        const total = result.reduce((sum, tx) => sum + tx.amount, 0);
        return { transactions: result, total };
    }, [filteredTransactions, searchType, amountQuery]);
    
    const handleCategoryAll = (type: 'income' | 'expense') => {
        setCategoryType(type);
        setCategoryQuery('ALL');
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content large">
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>조회</h2>
                <div className="search-controls">
                    <div className="form-group date-range">
                        <label>기간 설정:</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <span>~</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="tabs">
                        <button className={`tab-button ${searchType === 'name' ? 'active' : ''}`} onClick={() => setSearchType('name')}>이름 조회</button>
                        <button className={`tab-button ${searchType === 'category' ? 'active' : ''}`} onClick={() => setSearchType('category')}>항목별 조회</button>
                        <button className={`tab-button ${searchType === 'amount' ? 'active' : ''}`} onClick={() => setSearchType('amount')}>특정금액조회</button>
                    </div>
                    {searchType === 'name' && (
                        <div className="form-group">
                            <label>이름:</label>
                            <select value={nameQuery} onChange={e => setNameQuery(Number(e.target.value))}>
                                <option value="" disabled>-- 성도 선택 --</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                    )}
                    {searchType === 'category' && (
                        <div className="category-search-container">
                            <div className="category-search-group" style={{ flexWrap: 'wrap' }}>
                                <select value={categoryType} onChange={e => { setCategoryType(e.target.value as 'income' | 'expense'); setCategoryQuery(''); }}>
                                    <option value="income">입금</option>
                                    <option value="expense">출금</option>
                                </select>
                                <select value={categoryQuery === 'ALL' ? '' : categoryQuery} onChange={e => setCategoryQuery(e.target.value)}>
                                    <option value="" disabled>-- 항목 선택 --</option>
                                    {(categoryType === 'income' ? incomeCategories : expenseCategories).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="all-view-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button 
                                        type="button" 
                                        className={`action-btn edit ${categoryType === 'income' && categoryQuery === 'ALL' ? 'active' : ''}`} 
                                        onClick={() => handleCategoryAll('income')}
                                        style={{ padding: '0.6rem 1rem' }}
                                    >
                                        입금전체
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`action-btn delete ${categoryType === 'expense' && categoryQuery === 'ALL' ? 'active' : ''}`} 
                                        onClick={() => handleCategoryAll('expense')}
                                        style={{ padding: '0.6rem 1rem' }}
                                    >
                                        출금전체
                                    </button>
                                </div>
                            </div>
                            <div className="today-totals-summary">
                                <div><span>오늘의 입금 총액</span><span className="income-color">{todaysTotals.totalIncome.toLocaleString()}원</span></div>
                                <div><span>오늘의 출금 총액</span><span className="expense-color">{todaysTotals.totalExpense.toLocaleString()}원</span></div>
                            </div>
                        </div>
                    )}
                    {searchType === 'amount' && (
                        <div className="form-group">
                            <label>금액:</label>
                            <input type="number" placeholder="금액을 입력하세요" value={amountQuery} onChange={e => setAmountQuery(e.target.value === '' ? '' : Number(e.target.value))} />
                        </div>
                    )}
                </div>
                <div className="search-results">
                    {nameSearchResult && (
                        <><h3>{getMemberName(nameQuery)}님 헌금 내역 (총: {nameSearchResult.total.toLocaleString()}원)</h3>
                        <ul>{nameSearchResult.transactions.map(tx => <li key={tx.id}>{tx.date} | {tx.category}: {tx.amount.toLocaleString()}원</li>)}</ul></>
                    )}
                    {categorySearchResult && (
                        <>
                            <h3>{categoryQuery === 'ALL' ? (categoryType === 'income' ? '입금 전체 합산' : '출금 전체 합산') : `${categoryQuery} 내역`} (총: {categorySearchResult.total.toLocaleString()}원)</h3>
                            {categoryQuery === 'ALL' ? (
                                <ul className="category-summary-list">
                                    {categorySearchResult.breakdown.map(item => (
                                        <li key={item.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 1rem', borderBottom: '1px solid #eee' }}>
                                            <span style={{ fontWeight: '500' }}>{item.category}</span>
                                            <span style={{ color: categoryType === 'income' ? 'var(--income-color)' : 'var(--expense-color)', fontWeight: 'bold' }}>
                                                {item.total.toLocaleString()}원
                                            </span>
                                        </li>
                                    ))}
                                    <li style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f8f9fa', marginTop: '0.5rem', borderRadius: '8px' }}>
                                        <span style={{ fontWeight: 'bold' }}>합계</span>
                                        <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#d50000' }}>{categorySearchResult.total.toLocaleString()}원</span>
                                    </li>
                                </ul>
                            ) : (
                                <ul>{categorySearchResult.transactions.map(tx => (
                                    <li key={tx.id}>
                                        {tx.date} | {tx.type === 'income' ? getMemberName(tx.memberId) : (tx.memo || '메모 없음')}: {tx.amount.toLocaleString()}원
                                    </li>
                                ))}</ul>
                            )}
                        </>
                    )}
                    {amountSearchResult && (
                        <><h3>{Number(amountQuery).toLocaleString()}원 내역 (총: {amountSearchResult.total.toLocaleString()}원)</h3>
                        <ul>{amountSearchResult.transactions.map(tx => (<li key={tx.id}>{tx.date} | <span className={tx.type === 'income' ? 'income-color' : 'expense-color'}>{tx.type === 'income' ? ' [입금]' : ' [출금]'}</span> {' '} {tx.type === 'income' ? `${getMemberName(tx.memberId)} (${tx.category})` : `${tx.category}${tx.memo ? ` (${tx.memo})` : ''}`} : {tx.amount.toLocaleString()}원</li>))}</ul></>
                    )}
                </div>
            </div>
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);