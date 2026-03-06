/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PieChart as PieChartIcon, 
  ArrowUpRight, 
  ArrowDownRight,
  Trash2,
  ChevronRight,
  LayoutDashboard,
  PlusCircle,
  History,
  Eye,
  EyeOff,
  Calculator,
  Download,
  Upload,
  CalendarDays,
  LineChart as LineChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { Category, Income, Transaction, FinanceData, CategoryType, ForecastTransaction } from './types';

const STORAGE_KEY = 'finance_dashboard_v2_data';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#EF4444', '#06B6D4'];

const initialData: FinanceData = {
  baseCapital: 0,
  incomes: [],
  categories: [],
  forecastTransactions: []
};

export default function App() {
  const [data, setData] = useState<FinanceData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Ensure all categories have a type
      parsed.categories = parsed.categories.map((cat: any) => ({
        ...cat,
        type: cat.type || 'expense'
      }));
      parsed.forecastTransactions = parsed.forecastTransactions || [];
      return parsed;
    }
    return initialData;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'income' | 'runway' | 'forecast' | 'categories' | string>('dashboard');
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isBaseCapitalModalOpen, setIsBaseCapitalModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [showVisuals, setShowVisuals] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryType, setSelectedCategoryType] = useState<string>('expense');
  const [manualTypeName, setManualTypeName] = useState('');

  const handleExportData = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `finance_flow_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        // Basic validation
        if (json && typeof json.baseCapital === 'number' && Array.isArray(json.incomes) && Array.isArray(json.categories)) {
          if (confirm('This will overwrite your current data. Are you sure?')) {
            setData(json);
            alert('Data imported successfully!');
          }
        } else {
          alert('Invalid data format. Please provide a valid backup file.');
        }
      } catch (err) {
        alert('Error parsing JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // Calculations
  const totalIncome = useMemo(() => 
    data.incomes.reduce((sum, inc) => sum + inc.amount, 0), 
  [data.incomes]);

  const totalCapital = useMemo(() => 
    data.baseCapital + totalIncome + data.categories.reduce((sum, cat) => 
      sum + cat.transactions.reduce((tSum, t) => t.type === 'return' ? t.amount : 0, 0), 0
    ), 
  [data.baseCapital, totalIncome, data.categories]);

  const totalAllocated = useMemo(() => 
    data.categories.reduce((sum, cat) => sum + cat.allocatedBudget, 0), 
  [data.categories]);

  const totalRemaining = totalCapital - totalAllocated;
  
  const totalUnusedInCategories = useMemo(() => {
    return data.categories.reduce((sum, cat) => {
      const spent = cat.transactions.reduce((s, t) => (t.type === 'expense' || t.type === 'investment') ? s + t.amount : s, 0);
      const returns = cat.transactions.reduce((s, t) => t.type === 'return' ? s + t.amount : s, 0);
      return sum + (cat.allocatedBudget - spent + returns);
    }, 0);
  }, [data.categories]);

  const typeBalances = useMemo(() => {
    const balances: Record<string, { allocated: number, spent: number, balance: number }> = {};

    data.categories.forEach(cat => {
      const type = cat.type || 'other';
      if (!balances[type]) {
        balances[type] = { allocated: 0, spent: 0, balance: 0 };
      }
      
      const spent = cat.transactions.reduce((s, t) => (t.type === 'expense' || t.type === 'investment') ? s + t.amount : s, 0);
      const returns = cat.transactions.reduce((s, t) => t.type === 'return' ? s + t.amount : s, 0);
      const currentBalance = cat.allocatedBudget - spent + returns;
      
      balances[type].allocated += cat.allocatedBudget;
      balances[type].spent += spent;
      balances[type].balance += currentBalance;
    });

    return balances;
  }, [data.categories]);

  const categoryStats = useMemo(() => {
    return data.categories.map(cat => {
      const spent = cat.transactions.reduce((sum, t) => (t.type === 'expense' || t.type === 'investment') ? sum + t.amount : sum, 0);
      const returns = cat.transactions.reduce((sum, t) => t.type === 'return' ? sum + t.amount : sum, 0);
      const investments = cat.transactions.reduce((sum, t) => t.type === 'investment' ? sum + t.amount : sum, 0);
      const currentBudget = cat.allocatedBudget - spent + returns;
      const percentageOfTotal = totalCapital > 0 ? (cat.allocatedBudget / totalCapital) * 100 : 0;
      const usagePercentage = cat.allocatedBudget > 0 ? (spent / cat.allocatedBudget) * 100 : 0;

      return {
        ...cat,
        spent,
        returns,
        investments,
        currentBudget,
        percentageOfTotal,
        usagePercentage
      };
    });
  }, [data.categories, totalCapital]);

  // Handlers
  const handleUpdateBaseCapital = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    
    // Calculate what the new total capital would be
    const newTotalCapital = amount + totalIncome + data.categories.reduce((sum, cat) => 
      sum + cat.transactions.reduce((tSum, t) => t.type === 'return' ? t.amount : 0, 0), 0
    , 0);

    if (newTotalCapital < totalAllocated) {
      setError(`New capital is less than total allocated funds. Minimum base capital needed: ${formatCurrency(totalAllocated - (totalIncome + data.categories.reduce((sum, cat) => sum + cat.transactions.reduce((tSum, t) => t.type === 'return' ? t.amount : 0, 0), 0, 0)))}`);
      return;
    }

    setData(prev => ({ ...prev, baseCapital: amount }));
    setIsBaseCapitalModalOpen(false);
    setError(null);
  };

  const handleUpdateCategoryBudget = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCategoryId) return;
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('budget'));
    
    const currentCat = data.categories.find(c => c.id === selectedCategoryId);
    const otherAllocations = totalAllocated - (currentCat?.allocatedBudget || 0);
    
    if (amount + otherAllocations > totalCapital) {
      setError(`Allocation exceeds total capital. Max available: ${formatCurrency(totalCapital - otherAllocations)}`);
      return;
    }

    setData(prev => ({
      ...prev,
      categories: prev.categories.map(cat => 
        cat.id === selectedCategoryId 
          ? { ...cat, allocatedBudget: amount }
          : cat
      )
    }));
    setIsEditCategoryModalOpen(false);
    setError(null);
  };
  const handleAddIncome = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newIncome: Income = {
      id: crypto.randomUUID(),
      date: formData.get('date') as string,
      source: formData.get('source') as string,
      amount: Number(formData.get('amount'))
    };
    setData(prev => ({
      ...prev,
      incomes: [newIncome, ...prev.incomes]
    }));
    setIsIncomeModalOpen(false);
  };

  const handleAddCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const budget = Number(formData.get('budget'));

    if (budget > totalRemaining) {
      setError(`Allocation exceeds remaining capital. Max available: ${formatCurrency(totalRemaining)}`);
      return;
    }

    const newCategory: Category = {
      id: crypto.randomUUID(),
      name: formData.get('name') as string,
      type: selectedCategoryType === 'custom' ? manualTypeName : selectedCategoryType,
      allocatedBudget: budget,
      transactions: []
    };
    setData(prev => ({
      ...prev,
      categories: [...prev.categories, newCategory]
    }));
    setIsCategoryModalOpen(false);
    setManualTypeName('');
    setSelectedCategoryType('expense');
    setError(null);
  };

  const handleAddTransaction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCategoryId) return;

    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const type = formData.get('type') as 'expense' | 'return';

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      date: formData.get('date') as string,
      description: formData.get('description') as string,
      amount,
      type
    };

    setData(prev => ({
      ...prev,
      categories: prev.categories.map(cat => 
        cat.id === selectedCategoryId 
          ? { ...cat, transactions: [newTransaction, ...cat.transactions] }
          : cat
      )
    }));
    setIsTransactionModalOpen(false);
  };

  const handleDeleteIncome = (id: string) => {
    setData(prev => ({
      ...prev,
      incomes: prev.incomes.filter(inc => inc.id !== id)
    }));
  };

  const handleDeleteCategory = (id: string) => {
    setData(prev => ({
      ...prev,
      categories: prev.categories.filter(cat => cat.id !== id)
    }));
    if (activeTab === id) setActiveTab('dashboard');
  };

  const handleDeleteTransaction = (catId: string, transId: string) => {
    setData(prev => ({
      ...prev,
      categories: prev.categories.map(cat => 
        cat.id === catId 
          ? { ...cat, transactions: cat.transactions.filter(t => t.id !== transId) }
          : cat
      )
    }));
  };

  const handleSetBaseCapital = (amount: number) => {
    setData(prev => ({ ...prev, baseCapital: amount }));
  };

  const handleAddForecastTransaction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newTransaction: ForecastTransaction = {
      id: crypto.randomUUID(),
      date: formData.get('date') as string,
      name: formData.get('name') as string,
      amount: Number(formData.get('amount')),
      type: formData.get('type') as 'income' | 'expense',
      category: formData.get('category') as string,
      recurring: formData.get('recurring') as 'none' | 'weekly' | 'monthly'
    };
    setData(prev => ({
      ...prev,
      forecastTransactions: [...prev.forecastTransactions, newTransaction]
    }));
    setIsForecastModalOpen(false);
  };

  const handleDeleteForecastTransaction = (id: string) => {
    setData(prev => ({
      ...prev,
      forecastTransactions: prev.forecastTransactions.filter(t => t.id !== id)
    }));
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 p-6 z-20 hidden md:block">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
            <Wallet size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">FinanceFlow</h1>
        </div>

        <nav className="space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('income')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'income' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <TrendingUp size={20} />
            Income
          </button>
          <button 
            onClick={() => setActiveTab('runway')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'runway' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Calculator size={20} />
            Runway Calculator
          </button>
          <button 
            onClick={() => setActiveTab('forecast')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'forecast' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <LineChartIcon size={20} />
            Forecasting
          </button>
          
          <div className="pt-6 pb-2 px-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Categories</p>
          </div>
          
          {data.categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === cat.id ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="truncate">{cat.name}</span>
            </button>
          ))}

          <button 
            onClick={() => setIsCategoryModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all mt-4 border border-dashed border-emerald-200"
          >
            <PlusCircle size={20} />
            New Category
          </button>

          <div className="pt-8 mt-8 border-t border-gray-100 space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Data Management</p>
            <button 
              onClick={handleExportData}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-emerald-600 transition-all text-sm"
            >
              <Download size={16} />
              Export Backup
            </button>
            <label className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-emerald-600 transition-all text-sm cursor-pointer">
              <Upload size={16} />
              Import Backup
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportData} 
                className="hidden" 
              />
            </label>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            {activeTab !== 'forecast' && (
              <>
                <h2 className="text-2xl font-bold text-gray-900">
                  {activeTab === 'dashboard' ? 'Financial Overview' : 
                   activeTab === 'income' ? 'Income' : 
                   activeTab === 'runway' ? 'Runway Calculator' :
                   data.categories.find(c => c.id === activeTab)?.name || 'Category Details'}
                </h2>
                <p className="text-gray-500">Manage your capital and tracking efficiently.</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'income' && (
              <button 
                onClick={() => setIsIncomeModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-sm"
              >
                <Plus size={20} />
                Add Income
              </button>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="relative group">
                <SummaryCard 
                  title="Total Funds" 
                  value={totalCapital} 
                  icon={<Wallet className="text-emerald-600" />} 
                  color="emerald"
                  subtitle={
                    <div className="space-y-1 mt-2 pt-2 border-t border-gray-50">
                      <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-gray-400">
                        <span>Allocated</span>
                        <span className="text-blue-600">{formatCurrency(totalAllocated)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-gray-400">
                        <span>Unallocated</span>
                        <span className="text-amber-600">{formatCurrency(totalRemaining)}</span>
                      </div>
                    </div>
                  }
                />
                <button 
                  onClick={() => setIsBaseCapitalModalOpen(true)}
                  className="absolute top-4 right-4 p-2 bg-white border border-gray-100 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-emerald-600"
                  title="Edit Base Capital"
                >
                  <Plus size={16} />
                </button>
              </div>
              <SummaryCard 
                title="Category Balances" 
                value={totalUnusedInCategories} 
                icon={<PieChartIcon className="text-blue-600" />} 
                color="blue"
                subtitle="Assigned but not yet spent"
              />
              <SummaryCard 
                title="Income Received" 
                value={totalIncome} 
                icon={<TrendingUp className="text-purple-600" />} 
                color="purple"
                subtitle="Total from all sources"
              />
            </div>

            {/* Account Type Balances List */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">Account Type Summary</h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Allocated • Usage • Balance</span>
              </div>
              <div className="divide-y divide-gray-50">
                {(() => {
                  const uniqueTypes: string[] = Array.from(new Set(data.categories.map(c => c.type as string)));
                  const displayTypes: string[] = uniqueTypes.length > 0 ? uniqueTypes : ['investment', 'saving', 'expense', 'other'];
                  
                  return displayTypes.map((type: string) => {
                    const stats = (typeBalances as Record<string, any>)[type] || { allocated: 0, spent: 0, balance: 0 };
                    const usagePercent = stats.allocated > 0 ? (stats.spent / stats.allocated) * 100 : 0;
                    
                    const typeConfig = {
                      investment: { label: 'Investment Accounts', icon: <ArrowUpRight size={16} />, color: 'amber' },
                      saving: { label: 'Saving Accounts', icon: <Wallet size={16} />, color: 'emerald' },
                      expense: { label: 'Expense Accounts', icon: <TrendingDown size={16} />, color: 'red' },
                      other: { label: 'Other Accounts', icon: <PieChartIcon size={16} />, color: 'blue' }
                    }[type] || { label: `${type} Accounts`, icon: <PieChartIcon size={16} />, color: 'blue' };

                    return (
                      <div key={type} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className={`p-2 rounded-lg ${
                              typeConfig.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                              typeConfig.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                              typeConfig.color === 'red' ? 'bg-red-50 text-red-600' :
                              'bg-blue-50 text-blue-600'
                            }`}>
                              {typeConfig.icon}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-gray-900 capitalize">{typeConfig.label}</p>
                              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{stats.allocated > 0 ? `${usagePercent.toFixed(1)}% utilized` : 'No funds allocated'}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-8 flex-1">
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Allocated</p>
                              <p className="text-sm font-semibold text-gray-700">{formatCurrency(stats.allocated)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Usage</p>
                              <p className="text-sm font-semibold text-gray-700">{formatCurrency(stats.spent)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Left Balance</p>
                              <p className={`text-sm font-bold ${stats.balance > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{formatCurrency(stats.balance)}</p>
                            </div>
                          </div>
                        </div>
                        
                        {stats.allocated > 0 && (
                          <div className="mt-3 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(usagePercent, 100)}%` }}
                              className={`h-full rounded-full ${
                                typeConfig.color === 'amber' ? 'bg-amber-500' :
                                typeConfig.color === 'emerald' ? 'bg-emerald-500' :
                                typeConfig.color === 'red' ? 'bg-red-500' :
                                'bg-blue-500'
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Base Capital Setup (if zero) */}
            {data.baseCapital === 0 && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold mb-4">Initial Setup</h3>
                <p className="text-gray-500 mb-4">Set your starting base capital to begin tracking.</p>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    placeholder="Enter base capital..." 
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSetBaseCapital(Number(e.currentTarget.value));
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button 
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      handleSetBaseCapital(Number(input.value));
                      input.value = '';
                    }}
                    className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-semibold"
                  >
                    Set
                  </button>
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Category Allocation</h3>
                <button 
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-emerald-600 font-semibold text-sm hover:underline"
                >
                  Manage Categories
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryStats.map(cat => (
                  <CategoryCard 
                    key={cat.id} 
                    category={cat} 
                    onClick={() => setActiveTab(cat.id)}
                  />
                ))}
                {data.categories.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-gray-300">
                    <p className="text-gray-400">No categories created yet. Start by adding one!</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'income' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-bottom border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold">Income History</h3>
              <div className="text-sm text-gray-500">Total: <span className="font-bold text-emerald-600">{formatCurrency(totalIncome)}</span></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Source</th>
                    <th className="px-6 py-4 font-semibold">Amount</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.incomes.map(inc => (
                    <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm">{inc.date}</td>
                      <td className="px-6 py-4 text-sm font-medium">{inc.source}</td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600">+{formatCurrency(inc.amount)}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteIncome(inc.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.incomes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-gray-400">No income records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'runway' && (
          <RunwayCalculator initialCapital={totalCapital} />
        )}

        {activeTab === 'forecast' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Financial Forecast</h2>
                <p className="text-gray-500 text-sm">Projected balance over the next 6 months based on recurring events.</p>
              </div>
              <button 
                onClick={() => setIsForecastModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                <Plus size={20} />
                Add Forecast Event
              </button>
            </div>

            <ForecastingTool 
              initialBalance={totalUnusedInCategories} 
              forecastTransactions={data.forecastTransactions}
              onAddTransaction={() => setIsForecastModalOpen(true)}
              onDeleteTransaction={handleDeleteForecastTransaction}
            />
          </div>
        )}

        {/* Category Detail View */}
        {typeof activeTab === 'string' && activeTab !== 'dashboard' && activeTab !== 'income' && activeTab !== 'runway' && activeTab !== 'forecast' && (
          <div className="space-y-6">
            {categoryStats.find(c => c.id === activeTab) && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative group">
                    <p className="text-sm text-gray-500 mb-1">Allocated Budget</p>
                    <p className="text-2xl font-bold">{formatCurrency(categoryStats.find(c => c.id === activeTab)!.allocatedBudget)}</p>
                    <button 
                      onClick={() => {
                        setSelectedCategoryId(activeTab);
                        setIsEditCategoryModalOpen(true);
                      }}
                      className="absolute top-4 right-4 p-2 bg-gray-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-emerald-600"
                      title="Edit Budget"
                    >
                      <PlusCircle size={16} />
                    </button>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Total Spent</p>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency(categoryStats.find(c => c.id === activeTab)!.spent)}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(categoryStats.find(c => c.id === activeTab)!.currentBudget)}</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-bold">Transactions</h3>
                      <button 
                        onClick={() => setShowVisuals(!showVisuals)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showVisuals ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {showVisuals ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showVisuals ? 'Hide Visuals' : 'Show Visuals'}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleDeleteCategory(activeTab)}
                        className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                      >
                        Delete Category
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedCategoryId(activeTab);
                          setIsTransactionModalOpen(true);
                        }}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all"
                      >
                        Add Transaction
                      </button>
                    </div>
                  </div>

                  {showVisuals && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-6 border-b border-gray-100 bg-gray-50/50"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Pie Chart */}
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-[300px]">
                          <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">Budget Utilization</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={(() => {
                                  const cat = categoryStats.find(c => c.id === activeTab);
                                  if (!cat) return [];
                                  const chartData = cat.transactions
                                    .filter(t => t.type === 'expense')
                                    .map(t => ({ name: t.description, value: t.amount }));
                                  
                                  if (cat.currentBudget > 0) {
                                    chartData.push({ name: 'Remaining Balance', value: cat.currentBudget });
                                  }
                                  
                                  if (chartData.length === 0) return [{ name: 'No Data', value: 1 }];
                                  return chartData;
                                })()}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {(() => {
                                  const cat = categoryStats.find(c => c.id === activeTab);
                                  if (!cat) return null;
                                  const expenses = cat.transactions.filter(t => t.type === 'expense');
                                  const cells = expenses.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ));
                                  if (cat.currentBudget > 0) {
                                    cells.push(<Cell key="cell-remaining" fill="#E2E8F0" />); // Slate-200 for remaining
                                  }
                                  return cells;
                                })()}
                              </Pie>
                              <RechartsTooltip 
                                formatter={(value: number) => formatCurrency(value)}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                              <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Usage Bars */}
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm overflow-y-auto max-h-[300px]">
                          <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">Transaction Usage (% of Budget)</h4>
                          <div className="space-y-4">
                            {(() => {
                              const cat = categoryStats.find(c => c.id === activeTab);
                              if (!cat) return null;
                              
                              const transactionBars = cat.transactions.map(t => {
                                const percentage = (t.amount / cat.allocatedBudget) * 100;
                                return (
                                  <div key={t.id} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span className="font-medium text-gray-700 truncate max-w-[200px]">{t.description}</span>
                                      <span className={`font-bold ${t.type === 'expense' ? 'text-red-500' : 'text-emerald-600'}`}>
                                        {percentage.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(percentage, 100)}%` }}
                                        className={`h-full rounded-full ${t.type === 'expense' ? 'bg-red-400' : 'bg-emerald-400'}`}
                                      />
                                    </div>
                                  </div>
                                );
                              });

                              if (cat.currentBudget > 0) {
                                const unusedPercentage = (cat.currentBudget / cat.allocatedBudget) * 100;
                                transactionBars.push(
                                  <div key="unused-fund" className="space-y-1 pt-2 border-t border-gray-50">
                                    <div className="flex justify-between text-xs">
                                      <span className="font-bold text-gray-400 italic">Unused Funds</span>
                                      <span className="font-bold text-gray-400">
                                        {unusedPercentage.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(unusedPercentage, 100)}%` }}
                                        className="h-full rounded-full bg-gray-200"
                                      />
                                    </div>
                                  </div>
                                );
                              }

                              return transactionBars;
                            })()}
                            {data.categories.find(c => c.id === activeTab)?.transactions.length === 0 && (
                              <p className="text-center text-gray-400 text-sm py-10">No transactions to visualize.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Date</th>
                          <th className="px-6 py-4 font-semibold">Description</th>
                          <th className="px-6 py-4 font-semibold">Type</th>
                          <th className="px-6 py-4 font-semibold">Amount</th>
                          <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.categories.find(c => c.id === activeTab)?.transactions.map(t => (
                          <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm">{t.date}</td>
                            <td className="px-6 py-4 text-sm font-medium">{t.description}</td>
                            <td className="px-6 py-4 text-sm">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                t.type === 'expense' ? 'bg-red-100 text-red-600' : 
                                t.type === 'investment' ? 'bg-amber-100 text-amber-600' :
                                'bg-emerald-100 text-emerald-600'
                              }`}>
                                {t.type}
                              </span>
                            </td>
                            <td className={`px-6 py-4 text-sm font-bold ${
                              t.type === 'expense' ? 'text-red-500' : 
                              t.type === 'investment' ? 'text-amber-600' :
                              'text-emerald-600'
                            }`}>
                              {(t.type === 'expense' || t.type === 'investment') ? '-' : '+'}{formatCurrency(t.amount)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => handleDeleteTransaction(activeTab, t.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(data.categories.find(c => c.id === activeTab)?.transactions.length || 0) === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-gray-400">No transactions recorded for this category.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isIncomeModalOpen && (
          <Modal title="Add New Income" onClose={() => setIsIncomeModalOpen(false)}>
            <form onSubmit={handleAddIncome} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                <input required name="date" type="date" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Source</label>
                <input required name="source" type="text" placeholder="e.g., Monthly Salary" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount</label>
                <input required name="amount" type="number" step="1" placeholder="0" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">
                Record Income
              </button>
            </form>
          </Modal>
        )}

        {isCategoryModalOpen && (
          <Modal title="Create Main Category" onClose={() => { setIsCategoryModalOpen(false); setError(null); setSelectedCategoryType('expense'); setManualTypeName(''); }}>
            <form onSubmit={handleAddCategory} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Category Name</label>
                <input required name="name" type="text" placeholder="e.g., Investment, Business" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Account Type</label>
                <select 
                  required 
                  name="type" 
                  value={selectedCategoryType}
                  onChange={(e) => setSelectedCategoryType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="expense">Expense Account</option>
                  <option value="investment">Investment Account</option>
                  <option value="saving">Saving Account</option>
                  <option value="other">Other</option>
                  <option value="custom">Custom Name...</option>
                </select>
              </div>
              {selectedCategoryType === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Manual Type Name</label>
                  <input 
                    required 
                    type="text" 
                    value={manualTypeName}
                    onChange={(e) => setManualTypeName(e.target.value)}
                    placeholder="e.g., Crypto, Real Estate" 
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                  />
                </motion.div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Allocated Budget</label>
                <input required name="budget" type="number" step="1" placeholder="0" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                <p className="text-xs text-gray-400 mt-1">Available: {formatCurrency(totalRemaining)}</p>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">
                Create Category
              </button>
            </form>
          </Modal>
        )}

        {isTransactionModalOpen && (
          <Modal title="Add Transaction" onClose={() => setIsTransactionModalOpen(false)}>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                <input required name="date" type="date" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <input required name="description" type="text" placeholder="e.g., Office Supplies" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                <select name="type" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                  <option value="expense">Expense (Subtract from Budget)</option>
                  <option value="investment">Investment (Subtract from Budget, Track as Asset)</option>
                  <option value="return">Return/Profit (Add back to Budget & Capital)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount</label>
                <input required name="amount" type="number" step="1" placeholder="0" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">
                Save Transaction
              </button>
            </form>
          </Modal>
        )}

        {isBaseCapitalModalOpen && (
          <Modal title="Adjust Base Capital" onClose={() => { setIsBaseCapitalModalOpen(false); setError(null); }}>
            <form onSubmit={handleUpdateBaseCapital} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Base Capital Amount</label>
                <input 
                  required 
                  name="amount" 
                  type="number" 
                  step="1" 
                  placeholder="0" 
                  defaultValue={data.baseCapital}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                />
                <p className="text-xs text-gray-400 mt-2">
                  This is your starting balance. Total Capital is calculated as: <br/>
                  <span className="font-mono">Base Capital + Total Income + Category Returns</span>
                </p>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">
                Update Base Capital
              </button>
            </form>
          </Modal>
        )}

        {isEditCategoryModalOpen && (
          <Modal title="Adjust Category Budget" onClose={() => { setIsEditCategoryModalOpen(false); setError(null); }}>
            <form onSubmit={handleUpdateCategoryBudget} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  New Budget for {data.categories.find(c => c.id === selectedCategoryId)?.name}
                </label>
                <input 
                  required 
                  name="budget" 
                  type="number" 
                  step="1" 
                  placeholder="0" 
                  defaultValue={data.categories.find(c => c.id === selectedCategoryId)?.allocatedBudget}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                />
                <p className="text-xs text-gray-400 mt-2">
                  Total Capital: {formatCurrency(totalCapital)} <br/>
                  Total Allocated (other categories): {formatCurrency(totalAllocated - (data.categories.find(c => c.id === selectedCategoryId)?.allocatedBudget || 0))} <br/>
                  Available: {formatCurrency(totalCapital - (totalAllocated - (data.categories.find(c => c.id === selectedCategoryId)?.allocatedBudget || 0)))}
                </p>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">
                Update Budget
              </button>
            </form>
          </Modal>
        )}

        {isForecastModalOpen && (
          <Modal title="Add Forecast Transaction" onClose={() => setIsForecastModalOpen(false)}>
            <form onSubmit={handleAddForecastTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                <input required name="date" type="date" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input required name="name" type="text" placeholder="e.g., Salary, Rent" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                <select name="type" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Recurring</label>
                <select name="recurring" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                  <option value="none">One-time</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount</label>
                <input required name="amount" type="number" step="1" placeholder="0" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">
                Add to Forecast
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
function SummaryCard({ title, value, icon, color, subtitle }: { title: string, value: number, icon: React.ReactNode, color: string, subtitle?: React.ReactNode }) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{formatCurrency(value)}</p>
      {subtitle && <div className="text-xs text-gray-400 mt-2">{subtitle}</div>}
    </div>
  );
}

interface CategoryCardProps {
  category: any;
  onClick: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-200 cursor-pointer transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-lg group-hover:text-emerald-600 transition-colors">{category.name}</h4>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
              category.type === 'investment' ? 'bg-amber-100 text-amber-700' :
              category.type === 'saving' ? 'bg-emerald-100 text-emerald-700' :
              category.type === 'expense' ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {category.type}
            </span>
          </div>
          <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">{category.percentageOfTotal.toFixed(1)}% of Capital</p>
        </div>
        <ChevronRight size={20} className="text-gray-300 group-hover:text-emerald-500" />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Spent</span>
          <div className="text-right">
            <p className="font-bold">{formatCurrency(category.spent)} / {formatCurrency(category.allocatedBudget)}</p>
          </div>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(category.usagePercentage, 100)}%` }}
            className={`h-full rounded-full ${category.usagePercentage > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
          />
        </div>
        <div className="flex justify-between text-xs pt-2">
          <span className="text-gray-400">Current Balance</span>
          <div className="text-right">
            <p className={`font-bold ${category.currentBudget < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {formatCurrency(category.currentBudget)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Plus size={24} className="rotate-45" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// Runway Calculator Component
function RunwayCalculator({ initialCapital }: { initialCapital: number }) {
  const [capital, setCapital] = useState(initialCapital);
  const [recurringExpenses, setRecurringExpenses] = useState<{ id: string, name: string, amount: number }[]>([]);
  const [futureExpenses, setFutureExpenses] = useState<{ id: string, name: string, amount: number, month: number }[]>([]);
  const [results, setResults] = useState<{
    monthlyTotal: number;
    runway: number;
    runOutDate: string;
    timeline: { month: number, balance: number }[];
  } | null>(null);

  const addRecurring = () => {
    setRecurringExpenses([...recurringExpenses, { id: crypto.randomUUID(), name: '', amount: 0 }]);
  };

  const addFuture = () => {
    setFutureExpenses([...futureExpenses, { id: crypto.randomUUID(), name: '', amount: 0, month: 1 }]);
  };

  const calculate = () => {
    let monthlyTotal = recurringExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    let month = 0;
    let capitalRemaining = capital;
    let timeline = [];
    let maxMonths = 120;

    while (capitalRemaining > 0 && month < maxMonths) {
      month++;
      capitalRemaining -= monthlyTotal;

      futureExpenses
        .filter(item => item.month === month)
        .forEach(item => {
          capitalRemaining -= item.amount;
        });

      timeline.push({ month, balance: capitalRemaining });
    }

    const today = new Date();
    const runOutDate = new Date(today.getFullYear(), today.getMonth() + month);

    setResults({
      monthlyTotal,
      runway: month,
      runOutDate: runOutDate.toDateString(),
      timeline
    });
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Wallet className="text-emerald-600" size={20} />
              1. Capital
            </h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Available Funds</label>
              <input 
                type="number" 
                value={capital} 
                onChange={(e) => setCapital(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
              />
              <p className="text-xs text-gray-400 italic">Defaults to your current Total Capital</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingDown className="text-red-500" size={20} />
              2. Monthly Recurring Expenses
            </h3>
            <div className="space-y-3">
              {recurringExpenses.map((exp, index) => (
                <div key={exp.id} className="flex gap-2">
                  <input 
                    placeholder="Expense name"
                    value={exp.name}
                    onChange={(e) => {
                      const newExp = [...recurringExpenses];
                      newExp[index].name = e.target.value;
                      setRecurringExpenses(newExp);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-500"
                  />
                  <input 
                    type="number"
                    placeholder="Amount"
                    value={exp.amount || ''}
                    onChange={(e) => {
                      const newExp = [...recurringExpenses];
                      newExp[index].amount = Number(e.target.value);
                      setRecurringExpenses(newExp);
                    }}
                    className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-500"
                  />
                  <button 
                    onClick={() => setRecurringExpenses(recurringExpenses.filter(e => e.id !== exp.id))}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              <button 
                onClick={addRecurring}
                className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add Recurring Expense
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <History className="text-blue-500" size={20} />
              3. Future One-Time Expenses
            </h3>
            <div className="space-y-3">
              {futureExpenses.map((exp, index) => (
                <div key={exp.id} className="flex gap-2">
                  <input 
                    placeholder="Item name"
                    value={exp.name}
                    onChange={(e) => {
                      const newExp = [...futureExpenses];
                      newExp[index].name = e.target.value;
                      setFutureExpenses(newExp);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-500"
                  />
                  <input 
                    type="number"
                    placeholder="Amount"
                    value={exp.amount || ''}
                    onChange={(e) => {
                      const newExp = [...futureExpenses];
                      newExp[index].amount = Number(e.target.value);
                      setFutureExpenses(newExp);
                    }}
                    className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-500"
                  />
                  <input 
                    type="number"
                    placeholder="Month"
                    value={exp.month || ''}
                    onChange={(e) => {
                      const newExp = [...futureExpenses];
                      newExp[index].month = Number(e.target.value);
                      setFutureExpenses(newExp);
                    }}
                    className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-500"
                  />
                  <button 
                    onClick={() => setFutureExpenses(futureExpenses.filter(e => e.id !== exp.id))}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              <button 
                onClick={addFuture}
                className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add Future Expense
              </button>
            </div>
          </div>

          <button 
            onClick={calculate}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
          >
            <Calculator size={24} />
            Calculate Runway
          </button>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {results ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-emerald-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Calculator size={120} />
                </div>
                <div className="relative z-10">
                  <p className="text-emerald-200 text-sm font-bold uppercase tracking-widest mb-2">Estimated Runway</p>
                  <h4 className="text-6xl font-black mb-4">{results.runway} <span className="text-2xl font-normal opacity-70">Months</span></h4>
                  <div className="space-y-2 border-t border-emerald-800 pt-4">
                    <p className="flex justify-between text-emerald-100">
                      <span>Monthly Burn Rate:</span>
                      <span className="font-bold">{formatCurrency(results.monthlyTotal)}</span>
                    </p>
                    <p className="flex justify-between text-emerald-100">
                      <span>Run Out Date:</span>
                      <span className="font-bold">{results.runOutDate}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold mb-4">Monthly Timeline</h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {results.timeline.map((item) => (
                    <div key={item.month} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">
                          {item.month}
                        </span>
                        <span className="text-sm font-medium text-gray-700">Month {item.month}</span>
                      </div>
                      <span className={`font-bold text-sm ${item.balance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-300 mb-4">
                <Calculator size={40} />
              </div>
              <h4 className="text-xl font-bold text-gray-400">Ready to Calculate</h4>
              <p className="text-gray-400 max-w-xs mt-2">Enter your recurring and future expenses to see how long your capital will last.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Forecasting Tool Component
function ForecastingTool({ initialBalance, forecastTransactions, onAddTransaction, onDeleteTransaction }: { 
  initialBalance: number, 
  forecastTransactions: ForecastTransaction[],
  onAddTransaction: () => void,
  onDeleteTransaction: (id: string) => void
}) {
  const timelineData = useMemo(() => {
    const expanded: { date: string, amount: number, type: 'income' | 'expense', name: string, id: string }[] = [];
    const horizonMonths = 6;
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth() + horizonMonths, today.getDate());

    forecastTransactions.forEach(t => {
      const startDate = new Date(t.date);
      if (t.recurring === 'none') {
        expanded.push({ ...t });
      } else {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          expanded.push({
            id: `${t.id}-${currentDate.toISOString()}`,
            date: currentDate.toISOString().split('T')[0],
            amount: t.amount,
            type: t.type,
            name: t.name
          });
          if (t.recurring === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (t.recurring === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        }
      }
    });

    expanded.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let currentBalance = initialBalance;
    return expanded.map(t => {
      if (t.type === 'income') {
        currentBalance += t.amount;
      } else {
        currentBalance -= t.amount;
      }
      return {
        ...t,
        balance: currentBalance
      };
    });
  }, [initialBalance, forecastTransactions]);

  const futureBalance = timelineData.length > 0 ? timelineData[timelineData.length - 1].balance : initialBalance;
  const netChange = futureBalance - initialBalance;

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-2">Current Balance</p>
          <h4 className="text-2xl font-bold text-gray-900 tracking-tight">{formatCurrency(initialBalance)}</h4>
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
            <Wallet size={12} />
            <span>Available in categories</span>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-2">Projected Balance</p>
          <h4 className="text-2xl font-bold text-gray-900 tracking-tight">{formatCurrency(futureBalance)}</h4>
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
            <CalendarDays size={12} />
            <span>In 6 months</span>
          </div>
        </div>

        <div className={`p-6 rounded-2xl border shadow-sm ${netChange >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ${netChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Net Change</p>
          <h4 className={`text-2xl font-bold tracking-tight ${netChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {netChange >= 0 ? '+' : ''}{formatCurrency(netChange)}
          </h4>
          <div className={`mt-2 flex items-center gap-1 text-xs ${netChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {netChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{netChange >= 0 ? 'Projected growth' : 'Projected deficit'}</span>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Timeline Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Event Timeline</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.1em]">
                <tr>
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Event</th>
                  <th className="px-8 py-4">Amount</th>
                  <th className="px-8 py-4 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {timelineData.map((point) => (
                  <tr key={point.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-gray-500 font-mono">{point.date}</span>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-gray-900">{point.name}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                        point.type === 'income' ? 'text-emerald-500' : 'text-red-400'
                      }`}>
                        {point.type}
                      </span>
                    </td>
                    <td className={`px-8 py-5 text-sm font-bold ${
                      point.type === 'income' ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {point.type === 'income' ? '+' : '-'}{formatCurrency(point.amount)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(point.balance)}</span>
                    </td>
                  </tr>
                ))}
                {timelineData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <CalendarDays size={32} className="text-gray-200" />
                        <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">No events projected</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Configuration / Upcoming List */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Forecast Rules</h3>
              <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider">
                {forecastTransactions.length} Active
              </span>
            </div>
            <div className="space-y-4">
              {forecastTransactions.map(t => (
                <div key={t.id} className="group p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-200 hover:bg-white transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-sm text-gray-900">{t.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {t.type}
                        </span>
                        {t.recurring !== 'none' && (
                          <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                            <History size={10} />
                            {t.recurring}
                          </span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => onDeleteTransaction(t.id)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex justify-between items-end mt-4">
                    <p className="text-[10px] text-gray-400 font-bold font-mono">Starts {t.date}</p>
                    <p className={`font-bold text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {formatCurrency(t.amount)}
                    </p>
                  </div>
                </div>
              ))}
              {forecastTransactions.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">No rules defined</p>
                  <button 
                    onClick={() => onAddTransaction()}
                    className="mt-4 text-emerald-600 text-xs font-bold hover:underline"
                  >
                    Add your first rule
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Utils
function formatCurrency(amount: number) {
  if (Math.abs(amount) < 100000) {
    return new Intl.NumberFormat('en-MM').format(amount) + ' Ks';
  }
  const lakh = amount / 100000;
  const formattedLakh = Number(lakh.toFixed(2));
  return `${formattedLakh} Lakh`;
}

function formatMMKToLakh(amount: number) {
  return formatCurrency(amount);
}
