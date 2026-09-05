import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { User, Edit, Save, X, Trash2, Download, Search, Eye } from "lucide-react"
import { Button } from "../../components/ui/Button"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  created_at: string
  wallet_address: string | null
}

export function AdminUsers() {
  const { token } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState("")

  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  const [userDetails, setUserDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const handleViewUser = async (user: AdminUser) => {
    setSelectedUser(user)
    setUserDetails(null)
    setLoadingDetails(true)
    try {
      const res = await axios.get(`${API}/admin/users/${user.id}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        setUserDetails(res.data.data)
      }
    } catch (error) {
      console.error("Failed to fetch user details", error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        setUsers(res.data.data)
      }
    } catch (error) {
      console.error("Failed to fetch users", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleUpdateRole = async (id: string) => {
    try {
      await axios.put(`${API}/admin/users/${id}/role`, { role: editRole }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setEditingId(null)
      fetchUsers()
    } catch (error) {
      alert("Failed to update role")
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user?")) return;
    try {
      await axios.delete(`${API}/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchUsers()
    } catch (error) {
      alert("Failed to delete user")
    }
  }

  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Email", "Role", "Joined Date", "Wallet Address"]
    const csvContent = [
      headers.join(","),
      ...users.map(u => [
        u.id,
        `"${u.name}"`,
        `"${u.email}"`,
        u.role,
        new Date(u.created_at).toISOString(),
        u.wallet_address || "None"
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `farmchain_users_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    let matchesRole = false;
    if (roleFilter === "all") matchesRole = true;
    else if (roleFilter === "pending") matchesRole = u.role.startsWith("pending_");
    else matchesRole = u.role === roleFilter;

    return matchesSearch && matchesRole
  })

  if (loading) return <div className="p-8">Loading users...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Directory</h1>
          <p className="text-muted-foreground">Manage all users in the FarmChain ecosystem.</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
          <CardTitle>Registered Users ({filteredUsers.length})</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search name or email..."
                className="w-full pl-8 pr-4 py-2 text-sm border rounded-md bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="farmer">Farmer</option>
              <option value="processor">Processor</option>
              <option value="distributor">Distributor</option>
              <option value="retailer">Retailer</option>
              <option value="consumer">Consumer</option>
              <option value="pending">Pending Approval</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-slate-50 dark:bg-slate-900 border-b">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      {editingId === u.id ? (
                        <select 
                          className="p-1 border rounded"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                        >
                          {['admin', 'farmer', 'processor', 'distributor', 'retailer', 'consumer'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'} uppercase`}>
                          {u.role.replace('pending_', 'pending ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === u.id ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-4 w-4"/></Button>
                          <Button size="sm" onClick={() => handleUpdateRole(u.id)}><Save className="h-4 w-4"/></Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          {u.role.startsWith('pending_') && (
                            <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-600 mr-2" onClick={async () => {
                               try {
                                 await axios.put(`${API}/admin/users/${u.id}/role`, { role: u.role.replace('pending_', '') }, {
                                   headers: { Authorization: `Bearer ${token}` }
                                 });
                                 fetchUsers();
                               } catch { alert('Failed to approve user'); }
                            }}>
                              Approve
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleViewUser(u)}>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(u.id); setEditRole(u.role); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(u.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users found matching your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Advanced User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setSelectedUser(null)}>
          <div className="bg-background rounded-2xl p-6 max-w-3xl w-full shadow-2xl border border-white/10 my-8 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-2"><User className="text-primary h-6 w-6"/> User Profile</h3>
              <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-6 w-6" />
              </button>
            </div>

            {loadingDetails ? (
               <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            ) : userDetails ? (
              <div className="space-y-6 overflow-y-auto pr-2">
                {/* Profile Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Account Information</p>
                    <div><span className="font-semibold">Name:</span> {userDetails.user.name}</div>
                    <div><span className="font-semibold">Email:</span> {userDetails.user.email}</div>
                    <div><span className="font-semibold">Role:</span> <span className="uppercase px-2 py-0.5 rounded text-[10px] bg-primary/20 text-primary">{userDetails.user.role.replace('pending_', 'pending ')}</span></div>
                    <div><span className="font-semibold">Joined:</span> {new Date(userDetails.user.created_at).toLocaleDateString()}</div>
                  </div>
                  
                  <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Activity Stats</p>
                    <div className="flex justify-between items-center bg-background px-4 py-2 rounded-lg border">
                      <span className="text-sm">Total Batches Handled</span>
                      <span className="font-bold text-lg">{userDetails.stats.totalBatches}</span>
                    </div>
                    <div className="flex justify-between items-center bg-background px-4 py-2 rounded-lg border">
                      <span className="text-sm">Total Volume (kg)</span>
                      <span className="font-bold text-lg">{userDetails.stats.totalQuantity.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <span className="font-semibold text-sm">Wallet Address:</span> 
                  <div className="font-mono text-xs p-3 bg-muted rounded-lg break-all border">
                    {userDetails.user.wallet_address || "No wallet connected (Using secure wallet-less backend)"}
                  </div>
                </div>

                {/* Product History */}
                <div>
                  <h4 className="text-lg font-bold mb-3 flex items-center gap-2 mt-4">Transaction & Product History</h4>
                  {userDetails.products.length === 0 ? (
                    <div className="text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border text-muted-foreground">
                      No products or transactions found for this user.
                    </div>
                  ) : (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b">
                          <tr>
                            <th className="px-4 py-3">Product Name</th>
                            <th className="px-4 py-3">Batch</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {userDetails.products.map((p: any) => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                              <td className="px-4 py-3 font-medium">
                                {p.name}
                                <div className="text-[10px] text-muted-foreground">ID: #{p.product_id}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">{p.batch_number}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${p.status === 'Pending Approval' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-red-500">Failed to load user details.</div>
            )}
            
            <div className="mt-6 pt-4 border-t flex justify-end shrink-0">
              <Button onClick={() => setSelectedUser(null)}>Close Profile</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
