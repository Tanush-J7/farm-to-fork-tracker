import { ProfileManagementSection } from "../../components/profile/ProfileManagementSection"
import { useAuth } from "../../context/AuthContext"

export function Profile() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <ProfileManagementSection
        role="retailer"
        onProfileUpdated={(p) => {
          if (p?.address) {
            localStorage.setItem("retailer_address", p.address)
          }
          if (user?.email && p?.address) {
            try {
              const map = JSON.parse(localStorage.getItem("registered_user_profiles") || "{}")
              map[user.email.toLowerCase()] = {
                ...(map[user.email.toLowerCase()] || {}),
                address: p.address,
                business_name: p.business_name,
                phone: p.phone,
                license_number: p.license_number,
                coordinates: p.coordinates
              }
              localStorage.setItem("registered_user_profiles", JSON.stringify(map))
            } catch {}
          }
        }}
      />
    </div>
  )
}
