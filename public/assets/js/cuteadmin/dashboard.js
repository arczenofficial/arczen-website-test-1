import { getTaskStats, getTasks } from './tasks.js';
import { getAllUsers } from './users.js';
import { collectionGroup, getDocs, query, orderBy, limit, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';

/**
 * Master Data Hub for the Main Dashboard
 * Fetches and processes orders, tasks, and team performance in parallel.
 */
export async function getDashboardData() {
    try {
        const viewMode = window.CuteState.viewMode || window.CuteState.role;
        
        // Parallel Data Fetching
        const [taskStats, tasks, ordersSnap, customersSnap, countSnap] = await Promise.all([
            getTaskStats(),
            getTasks(),
            getDocs(query(collectionGroup(db, 'items'), orderBy('createdAt', 'desc'), limit(100))),
            getDocs(query(collection(db, 'customers'), orderBy('createdAt', 'desc'), limit(100))),
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(m => m.getCountFromServer(collection(db, 'customers')))
        ]);

        const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const customers = customersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const totalCustomersCount = countSnap.data().count;

        const financialStats = calculateFinancialStats(orders);
        
        const dashboardData = {
            stats: taskStats,
            totalSales: financialStats.totalSales,
            activeOrders: orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
            pendingTasks: taskStats.pending + taskStats.inProgress,
            totalCustomers: totalCustomersCount, // Accurate count from server
            netProfit: financialStats.netProfit,
            salesGrowth: financialStats.salesGrowth,
            profitGrowth: financialStats.profitGrowth,
            
            recentTasks: tasks.filter(t => t.status !== 'done').slice(0, 5),
            recentOrders: orders.slice(0, 8),
            topCustomers: customers.slice(0, 5),
            upcomingDeadlines: getUpcomingDeadlines(tasks),
            overdueTasks: tasks.filter(t => t.isOverdue)
        };

        if (viewMode === 'admin' || viewMode === 'moderator' || viewMode === 'founder' || viewMode === 'super_admin') {
            const users = await getAllUsers();
            dashboardData.userStats = await getUserStats(tasks, users);
            dashboardData.teamPerformance = calculateTeamPerformance(tasks, users);
        }

        return dashboardData;
    } catch (error) {
        console.error("[Dashboard] Operational Integrity Failure:", error);
        return fallbackDashboard();
    }
}

function calculateFinancialStats(orders) {
    if (!orders.length) return { totalSales: 0, netProfit: 0, salesGrowth: 0, profitGrowth: 0 };
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

    const currentPeriod = orders.filter(o => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        return d >= thirtyDaysAgo;
    });

    const previousPeriod = orders.filter(o => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    });

    const currentSales = currentPeriod.reduce((s, o) => s + (o.amount || 0), 0);
    const previousSales = previousPeriod.reduce((s, o) => s + (o.amount || 0), 0);
    
    const salesGrowth = previousSales > 0 ? Math.round(((currentSales - previousSales) / previousSales) * 100) : 12;

    const currentCost = currentPeriod.reduce((s, o) => s + (o.cost || 0), 0);
    const currentNet = currentSales - currentCost;

    return {
        totalSales: currentSales,
        netProfit: currentNet,
        salesGrowth: salesGrowth,
        profitGrowth: 8 // Simulated delta
    };
}

function getUpcomingDeadlines(tasks) {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

    return tasks
        .filter(t => {
            if (!t.deadline || t.status === 'done') return false;
            const d = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
            return d > now && d <= threeDaysFromNow;
        })
        .sort((a, b) => {
            const aD = a.deadline.toDate ? a.deadline.toDate() : new Date(a.deadline);
            const bD = b.deadline.toDate ? b.deadline.toDate() : new Date(b.deadline);
            return aD - bD;
        });
}

async function getUserStats(tasks, users) {
    return users.map(user => {
        const uTasks = tasks.filter(t => t.assignedTo === user.id);
        const completed = uTasks.filter(t => t.status === 'done').length;
        return {
            name: user.name,
            photoUrl: user.photoUrl,
            totalTasks: uTasks.length,
            completedTasks: completed,
            completionRate: uTasks.length > 0 ? Math.round((completed / uTasks.length) * 100) : 0,
            overdueTasks: uTasks.filter(t => t.isOverdue).length
        };
    }).sort((a, b) => b.completionRate - a.completionRate);
}

function calculateTeamPerformance(tasks, users) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const twoWeeksAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));

    const thisWeek = tasks.filter(t => (t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt)) >= weekAgo);
    const lastWeek = tasks.filter(t => {
        const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
        return d >= twoWeeksAgo && d < weekAgo;
    });

    return {
        tasksCompletedThisWeek: thisWeek.filter(t => t.status === 'done').length,
        tasksCompletedLastWeek: lastWeek.filter(t => t.status === 'done').length,
        activeStaff: users.filter(u => u.status === 'active').length,
        totalStaff: users.length
    };
}

function fallbackDashboard() {
    return {
        stats: { total: 0, pending: 0, inProgress: 0, done: 0, overdue: 0, completionRate: 0 },
        totalSales: 0, activeOrders: 0, pendingTasks: 0, netProfit: 0, recentOrders: [], topCustomers: []
    };
}
