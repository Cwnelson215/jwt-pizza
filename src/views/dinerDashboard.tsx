import React from 'react';
import { Link } from 'react-router-dom';
import View from './view';
import { pizzaService } from '../service/service';
import { Order, OrderHistory, Role, User } from '../service/pizzaService';

interface Props {
  user: User | null;
  setUser: (user: User) => void;
}

export default function DinerDashboard(props: Props) {
  const user = props.user || ({} as User);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [editOpen, setEditOpen] = React.useState(false);
  const nameRef = React.useRef<HTMLInputElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    (async () => {
      if (user) {
        const r: OrderHistory = await pizzaService.getOrders(user);
        setOrders(r.orders);
      }
    })();
  }, [user]);

  function formatRole(role: { role: Role; objectId?: string }) {
    if (role.role === Role.Franchisee) {
      return `Franchisee on ${role.objectId}`;
    }

    return role.role;
  }

  async function updateUser() {
    const updatedUser = await pizzaService.updateUser({
      id: user.id,
      name: nameRef.current?.value || user.name,
      email: emailRef.current?.value || user.email,
      password: passwordRef.current?.value || undefined,
    });
    props.setUser(updatedUser);
    setEditOpen(false);
  }

  return (
    <View title="Your pizza kitchen">
      <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
        <div className="hs-tooltip inline-block">
          <img className="hs-tooltip-toggle relative inline-block size-[96px] rounded-full ring-2 ring-white hover:z-10" src="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80" alt="Employee stock photo" />
        </div>
        <button type="button" className="ml-4 px-3 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800" onClick={() => setEditOpen(true)}>
          Edit
        </button>

        <div className="my-4 text-lg text-orange-200 text-start grid grid-cols-5 gap-2">
          <div className="font-semibold text-orange-400">name:</div> <div className="col-span-4">{user.name}</div>
          <div className="font-semibold text-orange-400">email:</div> <div className="col-span-4">{user.email}</div>
          <div className="font-semibold text-orange-400">role:</div>{' '}
          <div className="col-span-4">
            {user.roles &&
              user.roles.map((role, index) => (
                <span key={index}>
                  {index === 0 ? '' : ', '} {formatRole(role)}
                </span>
              ))}
          </div>
        </div>

        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Edit Profile</h3>
                <button type="button" className="text-gray-400 hover:text-gray-600" onClick={() => setEditOpen(false)}>
                  X
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input ref={nameRef} type="text" defaultValue={user.name} placeholder="Name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input ref={emailRef} type="email" defaultValue={user.email} placeholder="Email" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input ref={passwordRef} type="password" placeholder="New password (leave blank to keep)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800" />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100" onClick={() => setEditOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-800 text-white hover:bg-orange-600" onClick={updateUser}>
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {orders?.length === 0 && (
          <div className="text-neutral-100">
            How have you lived this long without having a pizza?{' '}
            <Link className="text-orange-400 underline font-semibold" to="/menu">
              Buy one
            </Link>{' '}
            now!
          </div>
        )}
        {orders?.length > 0 && (
          <>
            <div className="text-neutral-100">Here is your history of all the good times.</div>
            <div className="bg-neutral-100 overflow-clip my-4">
              <div className="flex flex-col">
                <div className="-m-1.5 overflow-x-auto">
                  <div className="p-1.5 min-w-full inline-block align-middle">
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-start text-xs sm:text-sm font-medium">
                              ID
                            </th>
                            <th scope="col" className="px-6 py-3 text-start text-xs sm:text-sm font-medium">
                              Price
                            </th>
                            <th scope="col" className="px-6 py-3 text-start text-xs sm:text-sm font-medium">
                              Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {orders.map((order, index) => (
                            <tr key={index} className="hover:bg-gray-100">
                              <td className="px-6 py-4 whitespace-nowrap text-start text-xs sm:text-sm font-medium text-gray-800">{order.id}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-start text-xs sm:text-sm text-gray-800">{order.items.reduce((a, c) => a + c.price, 0).toLocaleString()} ₿</td>
                              <td className="px-6 py-4 whitespace-nowrap text-start text-xs sm:text-sm text-gray-800">{order.date.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </View>
  );
}
